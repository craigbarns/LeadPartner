import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sendContractForMember, SendContractError } from '@/lib/contracts/send'

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

  // Authorization: caller must be the member themselves OR a company_admin
  const { data: target } = await supabase
    .from('tenant_members')
    .select('user_id, tenant_id')
    .eq('id', parsed.data.memberId)
    .single()
  if (!target) return NextResponse.json({ error: 'member_not_found' }, { status: 404 })

  const isSelf = target.user_id === user.id
  if (!isSelf) {
    const { data: callerMember } = await supabase
      .from('tenant_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', target.tenant_id)
      .single()
    if (!callerMember || callerMember.role !== 'company_admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  try {
    const { contractId } = await sendContractForMember(parsed.data.memberId)
    return NextResponse.json({ contractId, status: 'sent' })
  } catch (e) {
    if (e instanceof SendContractError) {
      return NextResponse.json({ error: e.code, detail: e.detail }, { status: 422 })
    }
    return NextResponse.json({ error: 'internal_error', detail: (e as Error).message }, { status: 500 })
  }
}
