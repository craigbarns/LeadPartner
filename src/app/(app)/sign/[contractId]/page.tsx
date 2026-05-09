import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  pending_info: 'En attente de vos informations',
  sent: 'Envoyé — en attente de signature',
  signed: 'Signé',
  declined: 'Refusé',
  expired: 'Expiré',
  canceled: 'Annulé',
}

export default async function SignPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single()

  if (!contract) notFound()

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

  return (
    <div className="container max-w-xl py-10">
      <Card>
        <CardHeader><CardTitle>Signature de votre contrat</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p>Un email vient de vous être envoyé par Yousign avec le lien de signature.</p>
          <p className="text-sm text-muted-foreground">
            Vérifiez votre boîte de réception (et vos spams). Une fois la signature effectuée,
            cette page se mettra à jour et vous aurez accès au dashboard.
          </p>
          <p className="text-sm">
            Statut actuel : <strong>{STATUS_LABELS[contract.status] ?? contract.status}</strong>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
