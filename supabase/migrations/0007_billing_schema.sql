-- =====================================================================
-- Billing & Stripe — extensions schéma
-- =====================================================================

-- 1. Étendre subscription_status (états Stripe)
alter type public.subscription_status add value if not exists 'incomplete';
alter type public.subscription_status add value if not exists 'incomplete_expired';
alter type public.subscription_status add value if not exists 'unpaid';

-- 2. Enrichir subscriptions
alter table public.subscriptions
  add column if not exists billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'annual')),
  add column if not exists included_seats integer not null default 3,
  add column if not exists extra_seats integer not null default 0,
  add column if not exists current_period_start timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists canceled_at timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists stripe_price_id text,
  add column if not exists stripe_extra_seat_price_id text;

-- Backfill trial pour lignes existantes
update public.subscriptions
set trial_ends_at = coalesce(trial_ends_at, now() + interval '14 days')
where trial_ends_at is null;

-- 3. Audit sièges
create table if not exists public.seat_changes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  type text not null check (type in ('add', 'remove')),
  member_id uuid references public.tenant_members(id) on delete set null,
  effective_at timestamptz not null default now(),
  changed_by uuid references public.profiles(id),
  proration_amount_cents integer,
  stripe_invoice_id text,
  created_at timestamptz not null default now()
);
create index if not exists seat_changes_tenant_idx on public.seat_changes(tenant_id, effective_at desc);

-- 4. Journal webhooks Stripe (idempotence)
create table if not exists public.stripe_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- 5. Fonctions sièges (SECURITY DEFINER + contrôle membre pour éviter la fuite inter-tenant)
create or replace function public.count_paid_seats(t uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_member_of(t) then
    return 0;
  end if;
  return (
    select count(*)::integer
    from public.tenant_members
    where tenant_id = t
      and status = 'active'
      and role in ('company_admin', 'collaborator')
  );
end;
$$;

create or replace function public.seats_remaining(t uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cap integer;
  paid integer;
begin
  if not public.is_member_of(t) then
    return 0;
  end if;
  select s.included_seats + s.extra_seats into cap
  from public.subscriptions s
  where s.tenant_id = t
  order by s.created_at desc
  limit 1;
  paid := public.count_paid_seats(t);
  return greatest(0, coalesce(cap, 0) - paid);
end;
$$;

grant execute on function public.count_paid_seats(uuid) to authenticated;
grant execute on function public.seats_remaining(uuid) to authenticated;

-- 6. RLS
alter table public.stripe_events enable row level security;

alter table public.seat_changes enable row level security;
drop policy if exists seat_changes_admin_read on public.seat_changes;
create policy seat_changes_admin_read on public.seat_changes
  for select using (public.is_admin_of(tenant_id));

-- Lecteurs abonnement : collaborateurs voient le statut (garde / bannière)
drop policy if exists subscriptions_member_read on public.subscriptions;
create policy subscriptions_member_read on public.subscriptions
  for select using (public.is_member_of(tenant_id));

-- 7. create_tenant : abonnement avec essai 14j et sièges
create or replace function public.create_tenant(
  p_name text,
  p_slug text,
  p_industry public.industry_code default 'other',
  p_primary_color text default '#0F172A'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_user_id uuid := auth.uid();
  v_program_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  insert into public.tenants (name, slug, industry, primary_color)
  values (p_name, p_slug, p_industry, p_primary_color)
  returning id into v_tenant_id;

  insert into public.tenant_members (tenant_id, user_id, role, status)
  values (v_tenant_id, v_user_id, 'company_admin', 'active');

  insert into public.programs (tenant_id, name, slug, description)
  values (
    v_tenant_id,
    'Programme apporteurs',
    'default',
    'Programme par défaut. Configurez-le dans Paramètres > Programme.'
  )
  returning id into v_program_id;

  insert into public.commission_rules (tenant_id, name, type, base, percentage, is_default)
  values (v_tenant_id, 'Commission par défaut', 'percentage', 'contract_amount', 5, true);

  insert into public.subscriptions (
    tenant_id, plan, status, trial_ends_at, included_seats, billing_cycle
  )
  values (
    v_tenant_id, 'starter', 'trialing', now() + interval '14 days', 3, 'monthly'
  );

  perform public.seed_industry_fields(v_tenant_id, p_industry);

  return v_tenant_id;
end;
$$;
