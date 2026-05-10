'use client'

import { useState } from 'react'
import { saveReferrerInfo } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Status = 'individual' | 'auto_entrepreneur' | 'company'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ReferrerOnboardingForm({ initial }: { initial: any }) {
  const [status, setStatus] = useState<Status | null>(initial?.referrer_status ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!status) {
    return (
      <Card>
        <CardHeader><CardTitle>Quel est votre statut ?</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start h-auto py-4" onClick={() => setStatus('individual')}>
            <div className="text-left">
              <div className="font-semibold">Particulier (apport occasionnel)</div>
              <div className="text-sm text-muted-foreground">Jusqu&apos;à 3 opérations par année civile.</div>
            </div>
          </Button>
          <Button variant="outline" className="w-full justify-start h-auto py-4" onClick={() => setStatus('auto_entrepreneur')}>
            <div className="text-left">
              <div className="font-semibold">Auto-entrepreneur</div>
              <div className="text-sm text-muted-foreground">Vous facturez via votre micro-entreprise (SIRET).</div>
            </div>
          </Button>
          <Button variant="outline" className="w-full justify-start h-auto py-4" onClick={() => setStatus('company')}>
            <div className="text-left">
              <div className="font-semibold">Société (SAS, SARL, etc.)</div>
              <div className="text-sm text-muted-foreground">Personne morale avec représentant légal.</div>
            </div>
          </Button>
        </CardContent>
      </Card>
    )
  }

  async function onSubmit(formData: FormData) {
    setSubmitting(true)
    setError(null)
    try {
      const data = Object.fromEntries(formData.entries())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(data as any).referrer_status = status
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(data as any).vat_applicable = data.vat_applicable === 'on'
      const result = await saveReferrerInfo(data)
      if (result?.ok === false) {
        setError(result.error)
        setSubmitting(false)
      }
    } catch (e) {
      setError((e as Error)?.message ?? 'Erreur')
      setSubmitting(false)
    }
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Vos informations</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {status === 'individual' && <IndividualFields />}
          {status === 'auto_entrepreneur' && <AutoEntrepreneurFields />}
          {status === 'company' && <CompanyFields />}
          <Field label="Adresse" name="address" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Code postal" name="postal_code" />
            <Field label="Ville" name="city" />
          </div>
          <Field label="Téléphone" name="phone" type="tel" />
          <Field label="IBAN" name="iban" />
          <Field label="BIC" name="bic" required={false} />
        </CardContent>
      </Card>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-between">
        <Button type="button" variant="ghost" onClick={() => setStatus(null)}>Retour</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Génération du contrat...' : 'Générer mon contrat'}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  name,
  type = 'text',
  required = true,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} />
    </div>
  )
}

function IndividualFields() {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Date de naissance" name="birth_date" type="date" />
        <Field label="Lieu de naissance" name="birth_place" />
      </div>
      <Field label="Nationalité" name="nationality" />
      <Field label="N° de sécurité sociale" name="social_security_number" />
    </>
  )
}

function AutoEntrepreneurFields() {
  return (
    <>
      <Field label="Date de naissance" name="birth_date" type="date" />
      <div className="grid grid-cols-2 gap-4">
        <Field label="SIRET" name="siret" />
        <Field label="Code NAF/APE" name="naf_code" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="vat_applicable" /> Assujetti à la TVA
      </label>
      <Field label="N° TVA intracom" name="vat_number" required={false} />
    </>
  )
}

function CompanyFields() {
  return (
    <>
      <Field label="Raison sociale" name="company_name" />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Forme juridique" name="legal_form" />
        <Field label="Capital social (€)" name="capital" type="number" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="SIRET" name="siret" />
        <Field label="Ville RCS" name="rcs_city" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="vat_applicable" /> Assujetti à la TVA
      </label>
      <Field label="N° TVA intracom" name="vat_number" required={false} />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nom du représentant légal" name="legal_representative_name" />
        <Field label="Qualité (Président, Gérant...)" name="legal_representative_role" />
      </div>
    </>
  )
}
