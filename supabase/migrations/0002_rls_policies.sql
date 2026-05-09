-- =====================================================================
-- LeadPartner — Row Level Security policies
-- Isolation stricte par tenant_id + rôles
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers : functions sécurité
-- ---------------------------------------------------------------------

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_super_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_member_of(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = tid
      and tm.user_id = auth.uid()
      and tm.status = 'active'
  ) or public.is_super_admin();
$$;

create or replace function public.is_admin_of(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = tid
      and tm.user_id = auth.uid()
      and tm.role = 'company_admin'
      and tm.status = 'active'
  ) or public.is_super_admin();
$$;

create or replace function public.is_collaborator_of(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = tid
      and tm.user_id = auth.uid()
      and tm.role in ('company_admin', 'collaborator')
      and tm.status = 'active'
  ) or public.is_super_admin();
$$;

create or replace function public.is_referrer_of(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = tid
      and tm.user_id = auth.uid()
      and tm.role = 'referrer'
      and tm.status = 'active'
  );
$$;

-- ---------------------------------------------------------------------
-- Activation RLS
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.programs enable row level security;
alter table public.referral_links enable row level security;
alter table public.opportunity_fields enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_status_history enable row level security;
alter table public.commission_rules enable row level security;
alter table public.commissions enable row level security;
alter table public.documents enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invitations enable row level security;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------

create policy "profiles_self_read"
  on public.profiles for select
  using (id = auth.uid() or public.is_super_admin());

create policy "profiles_self_update"
  on public.profiles for update
  using (id = auth.uid() or public.is_super_admin())
  with check (id = auth.uid() or public.is_super_admin());

create policy "profiles_super_admin_full"
  on public.profiles for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "profiles_team_read"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.tenant_members me
      join public.tenant_members other on other.tenant_id = me.tenant_id
      where me.user_id = auth.uid()
        and me.status = 'active'
        and other.user_id = profiles.id
    )
  );

-- ---------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------

create policy "tenants_member_read"
  on public.tenants for select
  using (public.is_member_of(id));

create policy "tenants_admin_update"
  on public.tenants for update
  using (public.is_admin_of(id))
  with check (public.is_admin_of(id));

create policy "tenants_super_admin_full"
  on public.tenants for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "tenants_authenticated_insert"
  on public.tenants for insert
  with check (auth.uid() is not null);

-- ---------------------------------------------------------------------
-- tenant_members
-- ---------------------------------------------------------------------

create policy "tenant_members_self_read"
  on public.tenant_members for select
  using (user_id = auth.uid() or public.is_member_of(tenant_id));

create policy "tenant_members_admin_write"
  on public.tenant_members for all
  using (public.is_admin_of(tenant_id))
  with check (public.is_admin_of(tenant_id));

create policy "tenant_members_self_insert"
  on public.tenant_members for insert
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- programs
-- ---------------------------------------------------------------------

create policy "programs_member_read"
  on public.programs for select
  using (public.is_member_of(tenant_id));

create policy "programs_admin_write"
  on public.programs for all
  using (public.is_admin_of(tenant_id))
  with check (public.is_admin_of(tenant_id));

-- ---------------------------------------------------------------------
-- referral_links
-- ---------------------------------------------------------------------

create policy "referral_links_member_read"
  on public.referral_links for select
  using (public.is_member_of(tenant_id));

create policy "referral_links_admin_write"
  on public.referral_links for all
  using (public.is_admin_of(tenant_id))
  with check (public.is_admin_of(tenant_id));

-- ---------------------------------------------------------------------
-- opportunity_fields
-- ---------------------------------------------------------------------

create policy "opportunity_fields_member_read"
  on public.opportunity_fields for select
  using (public.is_member_of(tenant_id));

create policy "opportunity_fields_admin_write"
  on public.opportunity_fields for all
  using (public.is_admin_of(tenant_id))
  with check (public.is_admin_of(tenant_id));

-- ---------------------------------------------------------------------
-- opportunities
-- ---------------------------------------------------------------------

create policy "opportunities_referrer_read_own"
  on public.opportunities for select
  using (
    public.is_collaborator_of(tenant_id)
    or (public.is_referrer_of(tenant_id) and referrer_id = auth.uid())
  );

create policy "opportunities_referrer_insert"
  on public.opportunities for insert
  with check (
    public.is_member_of(tenant_id)
    and (
      public.is_collaborator_of(tenant_id)
      or referrer_id = auth.uid()
    )
  );

create policy "opportunities_referrer_update_own"
  on public.opportunities for update
  using (
    public.is_collaborator_of(tenant_id)
    or (public.is_referrer_of(tenant_id) and referrer_id = auth.uid() and status in ('new', 'qualified'))
  )
  with check (
    public.is_collaborator_of(tenant_id)
    or (public.is_referrer_of(tenant_id) and referrer_id = auth.uid())
  );

create policy "opportunities_admin_delete"
  on public.opportunities for delete
  using (public.is_admin_of(tenant_id));

-- ---------------------------------------------------------------------
-- opportunity_status_history
-- ---------------------------------------------------------------------

create policy "opportunity_status_history_read"
  on public.opportunity_status_history for select
  using (
    public.is_collaborator_of(tenant_id)
    or exists (
      select 1
      from public.opportunities o
      where o.id = opportunity_status_history.opportunity_id
        and o.referrer_id = auth.uid()
    )
  );

create policy "opportunity_status_history_insert"
  on public.opportunity_status_history for insert
  with check (public.is_member_of(tenant_id));

-- ---------------------------------------------------------------------
-- commission_rules
-- ---------------------------------------------------------------------

create policy "commission_rules_member_read"
  on public.commission_rules for select
  using (public.is_member_of(tenant_id));

create policy "commission_rules_admin_write"
  on public.commission_rules for all
  using (public.is_admin_of(tenant_id))
  with check (public.is_admin_of(tenant_id));

-- ---------------------------------------------------------------------
-- commissions
-- ---------------------------------------------------------------------

create policy "commissions_referrer_read_own"
  on public.commissions for select
  using (
    public.is_collaborator_of(tenant_id)
    or (public.is_referrer_of(tenant_id) and referrer_id = auth.uid())
  );

create policy "commissions_admin_write"
  on public.commissions for all
  using (public.is_admin_of(tenant_id))
  with check (public.is_admin_of(tenant_id));

-- ---------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------

create policy "documents_member_read"
  on public.documents for select
  using (public.is_member_of(tenant_id));

create policy "documents_member_insert"
  on public.documents for insert
  with check (public.is_member_of(tenant_id));

create policy "documents_admin_delete"
  on public.documents for delete
  using (public.is_admin_of(tenant_id));

-- ---------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------

create policy "subscriptions_admin_read"
  on public.subscriptions for select
  using (public.is_admin_of(tenant_id));

create policy "subscriptions_super_admin_write"
  on public.subscriptions for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------------------------------------------------------------------
-- invitations
-- ---------------------------------------------------------------------

create policy "invitations_admin_all"
  on public.invitations for all
  using (public.is_admin_of(tenant_id))
  with check (public.is_admin_of(tenant_id));

create policy "invitations_self_read_by_email"
  on public.invitations for select
  using (
    email = (select email from public.profiles where id = auth.uid())
  );
