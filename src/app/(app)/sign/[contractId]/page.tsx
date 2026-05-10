import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { sendContractForMember, SendContractError } from '@/lib/contracts/send'
import { syncContractWithYousign } from '@/lib/contracts/sync'
import {
  requireActiveSubscription,
  SubscriptionGuardError,
} from '@/lib/auth/require-active-subscription'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  pending_info: 'En attente de vos informations',
  sent: 'Envoyé — en attente de signature',
  signed: 'Signé',
  declined: 'Refusé',
  expired: 'Expiré',
  canceled: 'Annulé',
}

export default async function SignPage({
  params,
  searchParams,
}: {
  params: Promise<{ contractId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { contractId } = await params
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: initialContract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single()

  if (!initialContract) notFound()

  let contract = initialContract
  let syncError: string | null = null

  if (contract.status === 'sent') {
    try {
      const synced = await syncContractWithYousign(contract.id)
      if (synced && synced.status !== contract.status) {
        const { data: refreshed } = await supabase
          .from('contracts')
          .select('*')
          .eq('id', contract.id)
          .single()
        contract = refreshed ?? contract
      }
    } catch (e) {
      syncError = (e as Error).message
    }
  }

  async function resendContract() {
    'use server'

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: target } = await supabase
      .from('contracts')
      .select('id, member_id, tenant_id')
      .eq('id', contractId)
      .single()

    if (!target) notFound()

    const { data: member } = await supabase
      .from('tenant_members')
      .select('id, user_id')
      .eq('id', target.member_id)
      .single()

    if (!member || member.user_id !== user.id) notFound()

    try {
      await requireActiveSubscription(target.tenant_id)
    } catch (e) {
      if (e instanceof SubscriptionGuardError) {
        redirect(`/sign/${contractId}?error=${encodeURIComponent('Abonnement inactif')}`)
      }
      throw e
    }

    let result: { contractId: string }
    try {
      result = await sendContractForMember(target.member_id)
    } catch (e) {
      const message = e instanceof SendContractError
        ? e.detail ?? e.code
        : 'Erreur serveur pendant la generation du contrat.'
      redirect(`/sign/${contractId}?error=${encodeURIComponent(message)}`)
    }

    redirect(`/sign/${result.contractId}`)
  }

  if (contract.status === 'signed') {
    return (
      <div className="container max-w-xl py-10">
        <Card>
          <CardHeader><CardTitle>Contrat signé ✅</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-4">
              Votre contrat a été signé{contract.signed_at ? ` le ${new Date(contract.signed_at).toLocaleDateString('fr-FR')}` : ''}.
            </p>
            <Button asChild><a href="/dashboard">Accéder au dashboard</a></Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isDraft = contract.status === 'draft' || contract.status === 'pending_info'

  return (
    <div className="container max-w-xl py-10">
      <Card>
        <CardHeader><CardTitle>Signature de votre contrat</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {isDraft ? (
            <>
              <p>Votre contrat est prêt, mais il n&apos;a pas encore été envoyé à Yousign.</p>
              <p className="text-sm text-muted-foreground">
                Relancez l&apos;envoi pour générer le lien de signature. Si Yousign refuse la
                demande, le détail s&apos;affichera ici.
              </p>
              <form action={resendContract}>
                <Button type="submit">Relancer l&apos;envoi du contrat</Button>
              </form>
            </>
          ) : (
            <>
              <p>Un email vient de vous être envoyé par Yousign avec le lien de signature.</p>
              <p className="text-sm text-muted-foreground">
                Vérifiez votre boîte de réception (et vos spams). Une fois la signature effectuée,
                cette page se mettra à jour et vous aurez accès au dashboard.
              </p>
            </>
          )}
          {(error || syncError) && (
            <p className="text-sm text-destructive">{error ?? syncError}</p>
          )}
          <p className="text-sm">
            Statut actuel : <strong>{STATUS_LABELS[contract.status] ?? contract.status}</strong>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
