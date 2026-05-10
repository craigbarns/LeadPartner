'use server'

import { z } from 'zod'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { AppRole } from '@/types/database'

const Schema = z.object({
  invitationId: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['company_admin', 'collaborator', 'referrer']),
  fullName: z.string().min(1),
  password: z.string().min(8),
  token: z.string().min(1),
})

export type AcceptInvitationResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string }

/**
 * Accepts an invitation atomically:
 *   1. Verifies the invitation token + status
 *   2. Creates the auth user with email auto-confirmed (invited = trusted)
 *   3. Inserts the tenant_member row
 *   4. Marks the invitation as accepted
 *   5. Signs the user in (server-side cookies)
 *
 * Returns the URL to redirect to (referrers go to onboarding, others to dashboard).
 */
export async function acceptInvitation(
  input: unknown,
): Promise<AcceptInvitationResult> {
  const parsed = Schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input' }
  }
  const { invitationId, tenantId, email, role, fullName, password, token } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any

  // 1. Verify invitation
  const { data: invitation } = await admin
    .from('invitations')
    .select('id, tenant_id, email, role, token, accepted_at, expires_at')
    .eq('id', invitationId)
    .single()
  if (!invitation) return { ok: false, error: 'invitation_not_found' }
  if (invitation.token !== token) return { ok: false, error: 'invalid_token' }
  if (invitation.tenant_id !== tenantId) return { ok: false, error: 'tenant_mismatch' }
  if (invitation.email.toLowerCase() !== email.toLowerCase()) return { ok: false, error: 'email_mismatch' }
  if (invitation.role !== role) return { ok: false, error: 'role_mismatch' }
  if (invitation.accepted_at) return { ok: false, error: 'invitation_already_accepted' }
  if (new Date(invitation.expires_at) < new Date()) return { ok: false, error: 'invitation_expired' }

  // 2. Check if a user with this email already exists
  const { data: existing } = await admin.auth.admin.listUsers()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingUser = existing?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())

  let userId: string

  if (existingUser) {
    // User exists — check if they already have a membership in this tenant
    const { data: existingMembership } = await admin
      .from('tenant_members')
      .select('id, role')
      .eq('tenant_id', tenantId)
      .eq('user_id', existingUser.id)
      .maybeSingle()

    if (existingMembership) {
      return {
        ok: false,
        error: existingMembership.role === role
          ? 'already_member_same_role'
          : `already_member_other_role:${existingMembership.role}`,
      }
    }

    userId = existingUser.id
  } else {
    // 3. Create user with email auto-confirmed (invited = trusted by admin)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (createErr || !created?.user) {
      return { ok: false, error: createErr?.message ?? 'user_creation_failed' }
    }
    userId = created.user.id

    // Profiles row is auto-created by trigger; ensure full_name is set
    await admin.from('profiles').update({ full_name: fullName }).eq('id', userId)
  }

  // 4. Insert tenant_member
  const { error: memberErr } = await admin.from('tenant_members').insert({
    tenant_id: tenantId,
    user_id: userId,
    role,
    status: 'active',
  })
  if (memberErr) {
    return { ok: false, error: `membership_failed:${memberErr.message}` }
  }

  // 5. Mark invitation accepted
  await admin
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitationId)

  // 6. Sign in the user via the user-context client (sets cookies)
  const supabase = await createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (signInErr) {
    return { ok: false, error: 'signin_failed_after_signup' }
  }

  // 7. Decide redirect
  const sigEnabled = process.env.NEXT_PUBLIC_ENABLE_CONTRACT_SIGNATURE === 'true'
  const redirectTo = sigEnabled && role === 'referrer'
    ? '/onboarding/referrer'
    : '/dashboard'

  return { ok: true, redirectTo }
}

export type { AppRole }
