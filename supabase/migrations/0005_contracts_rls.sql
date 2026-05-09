-- =====================================================================
-- RLS for contracts and yousign_events
-- =====================================================================

alter table public.contracts enable row level security;
alter table public.yousign_events enable row level security;

-- Admins of the tenant can see and modify contracts
create policy contracts_admin_all on public.contracts
  for all
  using (public.is_admin_of(tenant_id))
  with check (public.is_admin_of(tenant_id));

-- Referrers can see only their own contract
create policy contracts_member_select on public.contracts
  for select
  using (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid()
    )
  );

-- yousign_events: no policies = service role only (webhook handler)
-- (RLS enabled blocks all anon/authenticated by default)
