'use server'

import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  requireActiveSubscription,
  SubscriptionGuardError,
} from '@/lib/auth/require-active-subscription'

export async function markSignedOffline(memberId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('unauthorized')

  const { data: member } = await supabase
    .from('tenant_members').select('tenant_id').eq('id', memberId).single()
  if (!member) throw new Error('member_not_found')

  const { data: caller } = await supabase
    .from('tenant_members').select('role').eq('user_id', user.id).eq('tenant_id', member.tenant_id).single()
  if (caller?.role !== 'company_admin') throw new Error('forbidden')

  try {
    await requireActiveSubscription(member.tenant_id)
  } catch (e) {
    if (e instanceof SubscriptionGuardError) {
      throw new Error(`subscription_${e.reason}`)
    }
    throw e
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any
  await admin.from('contracts').insert({
    tenant_id: member.tenant_id,
    member_id: memberId,
    status: 'signed',
    signed_at: new Date().toISOString(),
    contract_data: { offline: true, marked_by: user.id },
  })

  revalidatePath(`/team/${memberId}`)
}
