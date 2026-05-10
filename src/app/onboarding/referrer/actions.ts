'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { encryptForStorage } from '@/lib/contracts/encryption'
import { sendContractForMember, SendContractError } from '@/lib/contracts/send'
import { redirect } from 'next/navigation'

type SaveReferrerInfoResult = { ok: false; error: string }

const optionalText = (schema: z.ZodString) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    schema.optional(),
  )

const baseSchema = z.object({
  address: z.string().min(3),
  postal_code: z.string().min(3),
  city: z.string().min(1),
  country: z.string().default('France'),
  phone: z.string().min(8),
  iban: z.string().min(15),
  bic: optionalText(z.string().min(8)),
})

const individualSchema = baseSchema.extend({
  referrer_status: z.literal('individual'),
  birth_date: z.string(),
  birth_place: z.string().min(1),
  nationality: z.string().default('Française'),
  social_security_number: z.string().min(13),
})

const aeSchema = baseSchema.extend({
  referrer_status: z.literal('auto_entrepreneur'),
  birth_date: z.string(),
  siret: z.string().length(14),
  naf_code: z.string().min(4),
  vat_applicable: z.boolean().default(false),
  vat_number: optionalText(z.string()),
})

const companySchema = baseSchema.extend({
  referrer_status: z.literal('company'),
  company_name: z.string().min(1),
  legal_form: z.string().min(2),
  siret: z.string().length(14),
  rcs_city: z.string().min(1),
  capital: z.coerce.number().min(0),
  vat_applicable: z.boolean().default(false),
  vat_number: optionalText(z.string()),
  legal_representative_name: z.string().min(1),
  legal_representative_role: z.string().min(1),
})

const ReferrerSchema = z.discriminatedUnion('referrer_status', [
  individualSchema, aeSchema, companySchema,
])

const ERROR_LABELS: Record<string, string> = {
  address: 'adresse',
  postal_code: 'code postal',
  city: 'ville',
  phone: 'telephone',
  iban: 'IBAN',
  bic: 'BIC',
  birth_date: 'date de naissance',
  birth_place: 'lieu de naissance',
  social_security_number: 'numero de securite sociale',
  siret: 'SIRET',
  naf_code: 'code NAF/APE',
  company_name: 'raison sociale',
  legal_form: 'forme juridique',
  rcs_city: 'ville RCS',
  legal_representative_name: 'nom du representant legal',
  legal_representative_role: 'qualite du representant legal',
}

function describeValidationError(error: z.ZodError) {
  const firstIssue = error.issues[0]
  const field = firstIssue?.path[0]
  const label = typeof field === 'string' ? ERROR_LABELS[field] ?? field : 'champ'
  return `Le champ ${label} est invalide ou incomplet.`
}

export async function saveReferrerInfo(input: unknown): Promise<SaveReferrerInfoResult | void> {
  const parsed = ReferrerSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: describeValidationError(parsed.error) }
  }

  const data = parsed.data
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Session expiree. Reconnectez-vous.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = {
    referrer_status: data.referrer_status,
    address: data.address,
    postal_code: data.postal_code,
    city: data.city,
    country: data.country,
    phone: data.phone,
    iban_encrypted: encryptForStorage(data.iban),
    bic: data.bic ?? null,
  }

  if (data.referrer_status === 'individual') {
    Object.assign(update, {
      birth_date: data.birth_date,
      birth_place: data.birth_place,
      nationality: data.nationality,
      social_security_number_encrypted: encryptForStorage(data.social_security_number),
    })
  } else if (data.referrer_status === 'auto_entrepreneur') {
    Object.assign(update, {
      birth_date: data.birth_date,
      siret: data.siret,
      naf_code: data.naf_code,
      vat_applicable: data.vat_applicable,
      vat_number: data.vat_number ?? null,
    })
  } else {
    Object.assign(update, {
      company_name: data.company_name,
      legal_form: data.legal_form,
      siret: data.siret,
      rcs_city: data.rcs_city,
      capital: data.capital,
      vat_applicable: data.vat_applicable,
      vat_number: data.vat_number ?? null,
      legal_representative_name: data.legal_representative_name,
      legal_representative_role: data.legal_representative_role,
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase.from('profiles') as any)
    .update(update)
    .eq('id', user.id)
  if (updateError) {
    return { ok: false, error: `Mise a jour du profil impossible: ${updateError.message}` }
  }

  // Find the referrer membership
  const { data: member } = await supabase
    .from('tenant_members')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .eq('role', 'referrer')
    .single()
  if (!member) return { ok: false, error: 'Aucune adhesion apporteur active trouvee.' }

  // Trigger contract send (inline — caller is the member themselves)
  let contractId: string
  try {
    const result = await sendContractForMember(member.id)
    contractId = result.contractId
  } catch (e) {
    if (e instanceof SendContractError) {
      return { ok: false, error: e.detail ?? e.code }
    }
    console.error('saveReferrerInfo failed', e)
    return { ok: false, error: 'Erreur serveur pendant la generation du contrat.' }
  }

  redirect(`/sign/${contractId}`)
}
