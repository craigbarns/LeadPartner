import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ReferrerOnboardingForm } from './referrer-onboarding-form'

export default async function ReferrerOnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="container max-w-2xl py-10">
      <h1 className="text-2xl font-semibold mb-2">Complétez votre profil</h1>
      <p className="text-muted-foreground mb-8">
        Ces informations sont nécessaires pour générer votre contrat d&apos;apporteur.
      </p>
      <ReferrerOnboardingForm initial={profile ?? null} />
    </div>
  )
}
