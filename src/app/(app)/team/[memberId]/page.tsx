import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MarkSignedOfflineButton } from './mark-signed-offline'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  pending_info: 'En attente d\'infos',
  sent: 'Envoyé',
  signed: 'Signé',
  declined: 'Refusé',
  expired: 'Expiré',
  canceled: 'Annulé',
}

export default async function TeamMemberPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params
  const supabase = await createClient()

  const { data: member } = await supabase
    .from('tenant_members')
    .select(`
      id, role, status, created_at,
      profile:profiles!tenant_members_user_id_fkey (full_name, email, referrer_status)
    `)
    .eq('id', memberId)
    .single()
  if (!member) notFound()

  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, status, sent_at, signed_at, signed_pdf_path')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = member.profile as any

  return (
    <div className="container py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{profile?.full_name ?? profile?.email}</h1>
        <p className="text-muted-foreground">{profile?.email}</p>
        <p className="text-sm text-muted-foreground mt-1">Rôle : {member.role}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Contrat d&apos;apporteur</CardTitle></CardHeader>
        <CardContent>
          {contracts && contracts.length > 0 ? (
            <ul className="space-y-3">
              {contracts.map((c) => (
                <li key={c.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <Badge>{STATUS_LABELS[c.status] ?? c.status}</Badge>
                    <span className="ml-3 text-sm text-muted-foreground">
                      {c.signed_at
                        ? `Signé le ${new Date(c.signed_at).toLocaleDateString('fr-FR')}`
                        : c.sent_at
                          ? `Envoyé le ${new Date(c.sent_at).toLocaleDateString('fr-FR')}`
                          : 'Brouillon'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun contrat émis.</p>
          )}
          <div className="mt-4">
            <MarkSignedOfflineButton memberId={memberId} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
