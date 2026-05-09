import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { generateContractPDF } from '@/lib/contracts/generator'
import { decrypt } from '@/lib/contracts/encryption'
import { maskIban, maskSSN } from '@/lib/contracts/snapshot'
import { createSignatureRequest } from '@/lib/yousign/create-request'
import type { ContractSnapshot, ReferrerSnapshot } from '@/lib/contracts/types'

const BodySchema = z.object({ memberId: z.string().uuid() })

export async function POST(req: Request) {
  if (process.env.ENABLE_CONTRACT_SIGNATURE !== 'true') {
    return NextResponse.json({ error: 'feature_disabled' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Load member + tenant + profile
  const { data: member, error: mErr } = await supabase
    .from('tenant_members')
    .select(`
      id, tenant_id, user_id, role,
      profile:profiles!tenant_members_user_id_fkey (*),
      tenant:tenants (*)
    `)
    .eq('id', parsed.data.memberId)
    .single()
  if (mErr || !member) return NextResponse.json({ error: 'member_not_found' }, { status: 404 })

  // Authorization: caller must be either the member themselves OR a company_admin of the tenant
  const isSelf = member.user_id === user.id
  if (!isSelf) {
    const { data: callerMember } = await supabase
      .from('tenant_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', member.tenant_id)
      .single()
    if (!callerMember || callerMember.role !== 'company_admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  // Default commission rule
  const { data: rule } = await supabase
    .from('commission_rules')
    .select('*')
    .eq('tenant_id', member.tenant_id)
    .eq('is_default', true)
    .single()
  if (!rule) return NextResponse.json({ error: 'no_commission_rule' }, { status: 422 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = member.profile as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant = member.tenant as any

  if (!profile?.referrer_status) {
    return NextResponse.json({ error: 'referrer_info_missing' }, { status: 422 })
  }

  const ibanPlain = profile.iban_encrypted
    ? decrypt(toBuffer(profile.iban_encrypted))
    : ''
  const ssnPlain = profile.social_security_number_encrypted
    ? decrypt(toBuffer(profile.social_security_number_encrypted))
    : ''

  const snapshot = buildSnapshot(profile, tenant, rule, ibanPlain, ssnPlain)
  const pdfBuffer = await generateContractPDF(snapshot)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any
  const { data: contract, error: cErr } = await admin
    .from('contracts')
    .insert({
      tenant_id: member.tenant_id,
      member_id: member.id,
      status: 'draft',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      contract_data: snapshot as any,
    })
    .select('*')
    .single()
  if (cErr || !contract) {
    return NextResponse.json({ error: 'contract_insert_failed', detail: cErr?.message }, { status: 500 })
  }

  const unsignedPath = `${member.tenant_id}/${contract.id}.pdf`
  const pdfBytes = new Uint8Array(pdfBuffer)
  await admin.storage
    .from('contracts-unsigned')
    .upload(unsignedPath, pdfBytes, { contentType: 'application/pdf', upsert: true })

  const fullName: string = profile.full_name ?? profile.email ?? ''
  const [firstName, ...rest] = fullName.split(' ')
  const lastName = rest.join(' ') || firstName || 'Apporteur'

  const created = await createSignatureRequest({
    name: `Contrat d'apporteur — ${tenant.legal_name ?? tenant.name}`,
    signerEmail: profile.email,
    signerFirstName: firstName || 'Apporteur',
    signerLastName: lastName,
    signerPhone: profile.phone ?? undefined,
    pdfBuffer,
    pdfFilename: `contrat-apporteur.pdf`,
  })

  await admin
    .from('contracts')
    .update({
      status: 'sent',
      yousign_signature_request_id: created.signatureRequestId,
      yousign_document_id: created.documentId,
      unsigned_pdf_path: unsignedPath,
      sent_at: new Date().toISOString(),
    })
    .eq('id', contract.id)

  return NextResponse.json({ contractId: contract.id, status: 'sent' })
}

// bytea round-trip: Supabase can return base64 string or hex-prefixed string ("\\x...")
function toBuffer(value: string | Buffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(value)) return value
  if (value instanceof Uint8Array) return Buffer.from(value)
  if (typeof value === 'string') {
    if (value.startsWith('\\x')) return Buffer.from(value.slice(2), 'hex')
    return Buffer.from(value, 'base64')
  }
  throw new Error('Unsupported encrypted column value')
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
