import { createServiceRoleClient } from '@/lib/supabase/server'
import { generateContractPDF } from '@/lib/contracts/generator'
import { bytesFromBytea, decrypt } from '@/lib/contracts/encryption'
import { maskIban, maskSSN } from '@/lib/contracts/snapshot'
import { createSignatureRequest } from '@/lib/yousign/create-request'
import { YousignError } from '@/lib/yousign/client'
import type { ContractSnapshot, ReferrerSnapshot } from '@/lib/contracts/types'

export type SendContractResult = { contractId: string }

export class SendContractError extends Error {
  constructor(public code: string, public detail?: string) {
    super(code)
  }
}

/**
 * Generates the contract PDF for `memberId`, uploads it, creates a Yousign
 * signature request, and persists the contract row. Returns the new contract id.
 *
 * Authorization checks (caller must be admin or the member themselves) MUST
 * be performed by the caller before invoking this function. This helper uses
 * the service role.
 */
export async function sendContractForMember(memberId: string): Promise<SendContractResult> {
  if (process.env.ENABLE_CONTRACT_SIGNATURE !== 'true') {
    throw new SendContractError('feature_disabled')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any

  const { data: member, error: mErr } = await admin
    .from('tenant_members')
    .select(`
      id, tenant_id, user_id, role,
      profile:profiles!tenant_members_user_id_fkey (*),
      tenant:tenants (*)
    `)
    .eq('id', memberId)
    .single()
  if (mErr || !member) throw new SendContractError('member_not_found', mErr?.message)

  const profile = member.profile
  const tenant = member.tenant
  if (!profile?.referrer_status) throw new SendContractError('referrer_info_missing')

  const { data: rule } = await admin
    .from('commission_rules')
    .select('*')
    .eq('tenant_id', member.tenant_id)
    .eq('is_default', true)
    .single()
  if (!rule) throw new SendContractError('no_commission_rule')

  let ibanPlain = ''
  let ssnPlain = ''
  try {
    if (profile.iban_encrypted) {
      ibanPlain = decrypt(bytesFromBytea(profile.iban_encrypted))
    }
    if (profile.social_security_number_encrypted) {
      ssnPlain = decrypt(bytesFromBytea(profile.social_security_number_encrypted))
    }
  } catch (e) {
    throw new SendContractError(
      'decryption_failed',
      `${(e as Error).message}. The encryption key may have rotated since the profile was filled. Reset profiles.iban_encrypted and social_security_number_encrypted, then have the referrer re-enter their info.`,
    )
  }

  const snapshot = buildSnapshot(profile, tenant, rule, ibanPlain, ssnPlain)
  const pdfBuffer = await generateContractPDF(snapshot)

  const { data: existingContracts, error: lookupErr } = await admin
    .from('contracts')
    .select('*')
    .eq('tenant_id', member.tenant_id)
    .eq('member_id', member.id)
    .in('status', ['draft', 'pending_info', 'sent', 'signed'])
    .order('created_at', { ascending: false })
    .limit(1)

  if (lookupErr) {
    throw new SendContractError('contract_lookup_failed', lookupErr.message)
  }

  let contract = existingContracts?.[0]

  if (contract?.status === 'sent' || contract?.status === 'signed') {
    return { contractId: contract.id }
  }

  if (contract) {
    const { data: updatedDraft, error: draftErr } = await admin
      .from('contracts')
      .update({
        status: 'draft',
        contract_data: snapshot,
      })
      .eq('id', contract.id)
      .select('*')
      .single()

    if (draftErr || !updatedDraft) {
      throw new SendContractError('contract_update_failed', draftErr?.message)
    }

    contract = updatedDraft
  } else {
    const { data: createdDraft, error: cErr } = await admin
      .from('contracts')
      .insert({
        tenant_id: member.tenant_id,
        member_id: member.id,
        status: 'draft',
        contract_data: snapshot,
      })
      .select('*')
      .single()

    if (cErr || !createdDraft) {
      throw new SendContractError('contract_insert_failed', cErr?.message)
    }

    contract = createdDraft
  }

  const unsignedPath = `${member.tenant_id}/${contract.id}.pdf`
  const pdfBytes = new Uint8Array(pdfBuffer)
  const { error: uploadErr } = await admin.storage
    .from('contracts-unsigned')
    .upload(unsignedPath, pdfBytes, { contentType: 'application/pdf', upsert: true })
  if (uploadErr) {
    throw new SendContractError('contract_upload_failed', uploadErr.message)
  }

  const fullName: string = profile.full_name ?? profile.email ?? ''
  const [first, ...rest] = fullName.split(' ')
  let created
  try {
    created = await createSignatureRequest({
      name: `Contrat d'apporteur — ${tenant.legal_name ?? tenant.name}`,
      signerEmail: profile.email,
      signerFirstName: first || 'Apporteur',
      signerLastName: rest.join(' ') || first || 'Apporteur',
      signerPhone: profile.phone?.trim() || undefined,
      pdfBuffer,
      pdfFilename: 'contrat-apporteur.pdf',
    })
  } catch (e) {
    if (e instanceof YousignError) {
      throw new SendContractError(
        'yousign_request_failed',
        describeYousignError(e),
      )
    }
    throw e
  }

  const { error: updateErr } = await admin
    .from('contracts')
    .update({
      status: 'sent',
      yousign_signature_request_id: created.signatureRequestId,
      yousign_document_id: created.documentId,
      unsigned_pdf_path: unsignedPath,
      sent_at: new Date().toISOString(),
    })
    .eq('id', contract.id)
  if (updateErr) {
    throw new SendContractError('contract_update_failed', updateErr.message)
  }

  return { contractId: contract.id }
}

function describeYousignError(error: YousignError) {
  const body = typeof error.body === 'string'
    ? error.body
    : JSON.stringify(error.body)

  return `Yousign a refuse la demande (${error.status}). ${body ?? ''}`.trim()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSnapshot(profile: any, tenant: any, rule: any, ibanPlain: string, ssnPlain: string): ContractSnapshot {
  const tenantSnap = {
    legal_name: tenant.legal_name ?? tenant.name,
    legal_form: tenant.legal_form ?? '',
    siret: tenant.siret ?? '',
    rcs_city: tenant.rcs_city ?? '',
    capital: Number(tenant.capital ?? 0),
    legal_address: tenant.legal_address ?? '',
    representative_name: tenant.representative_name ?? '',
    representative_role: tenant.representative_role ?? 'Représentant légal',
    industry: tenant.industry,
    carte_t_number: tenant.carte_t_number ?? undefined,
    carte_t_city: tenant.carte_t_city ?? undefined,
    caisse_garantie: tenant.caisse_garantie ?? undefined,
    orias_number: tenant.orias_number ?? undefined,
  }

  const common = {
    email: profile.email,
    phone: profile.phone ?? '',
    address: profile.address ?? '',
    postal_code: profile.postal_code ?? '',
    city: profile.city ?? '',
    country: profile.country ?? 'France',
    iban_masked: maskIban(ibanPlain),
  }

  const fullName: string = profile.full_name ?? ''
  const [first, ...last] = fullName.split(' ')

  let referrer: ReferrerSnapshot
  if (profile.referrer_status === 'individual') {
    referrer = {
      status: 'individual',
      first_name: first ?? '',
      last_name: last.join(' '),
      birth_date: profile.birth_date,
      birth_place: profile.birth_place ?? '',
      nationality: profile.nationality ?? 'Française',
      social_security_number_masked: maskSSN(ssnPlain),
      ...common,
    }
  } else if (profile.referrer_status === 'auto_entrepreneur') {
    referrer = {
      status: 'auto_entrepreneur',
      first_name: first ?? '',
      last_name: last.join(' '),
      birth_date: profile.birth_date,
      siret: profile.siret,
      naf_code: profile.naf_code ?? '',
      vat_applicable: !!profile.vat_applicable,
      vat_number: profile.vat_number ?? undefined,
      ...common,
    }
  } else {
    referrer = {
      status: 'company',
      company_name: profile.company_name,
      legal_form: profile.legal_form,
      siret: profile.siret,
      rcs_city: profile.rcs_city ?? '',
      capital: Number(profile.capital ?? 0),
      vat_applicable: !!profile.vat_applicable,
      vat_number: profile.vat_number ?? undefined,
      legal_representative_name: profile.legal_representative_name,
      legal_representative_role: profile.legal_representative_role,
      ...common,
    }
  }

  return {
    generated_at: new Date().toISOString(),
    tenant: tenantSnap,
    referrer,
    commission_rule: {
      name: rule.name,
      type: rule.type,
      base: rule.base,
      percentage: rule.percentage ?? undefined,
      fixed_amount: rule.fixed_amount ?? undefined,
    },
    contract_duration_months: 12,
    jurisdiction_city: tenantSnap.rcs_city || tenantSnap.legal_address || 'Paris',
  }
}
