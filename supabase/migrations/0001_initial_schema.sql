-- =====================================================================
-- LeadPartner — Schéma initial
-- Architecture multi-tenant avec isolation stricte par tenant_id (RLS)
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- ENUMS
-- =====================================================================

create type public.app_role as enum (
  'super_admin',
  'company_admin',
  'collaborator',
  'referrer'
);

create type public.industry_code as enum (
  'real_estate',
  'construction',
  'insurance',
  'credit',
  'automotive',
  'training',
  'b2b_services',
  'other'
);

create type public.opportunity_status as enum (
  'new',
  'qualified',
  'assigned',
  'contacted',
  'meeting_booked',
  'proposal_sent',
  'contract_signed',
  'sale_closed',
  'commission_due',
  'commission_paid',
  'rejected',
  'lost'
);

create type public.commission_status as enum (
  'estimated',
  'due',
  'validated',
  'paid',
  'canceled'
);

create type public.commission_rule_type as enum ('fixed', 'percentage', 'tiered');

create type public.commission_base as enum (
  'contract_amount',
  'fees',
  'signed_quote',
  'collected_revenue'
);

create type public.subscription_plan as enum ('starter', 'pro', 'business');

create type public.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'canceled'
);

create type public.tenant_member_status as enum ('active', 'invited', 'suspended');

-- =====================================================================
-- TABLES
-- =====================================================================

-- Profiles : extension de auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  avatar_url text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_email_idx on public.profiles(email);

-- Tenants : entreprises clientes
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  industry public.industry_code not null default 'other',
  logo_url text,
  primary_color text default '#0F172A',
  custom_domain text unique,
  subscription_plan public.subscription_plan not null default 'starter',
  subscription_status public.subscription_status not null default 'trialing',
  trial_ends_at timestamptz default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenants_slug_idx on public.tenants(slug);

-- Tenant members : association users <-> tenants avec rôle
create table public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null check (role <> 'super_admin'),
  status public.tenant_member_status not null default 'active',
  referral_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index tenant_members_tenant_idx on public.tenant_members(tenant_id);
create index tenant_members_user_idx on public.tenant_members(user_id);

-- Programs : programmes d'apporteurs configurables
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  terms text,
  public_signup_enabled boolean not null default false,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index programs_tenant_idx on public.programs(tenant_id);

-- Referral links : liens d'invitation uniques
create table public.referral_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  owner_user_id uuid references public.profiles(id) on delete set null,
  code text not null unique,
  uses_count integer not null default 0,
  max_uses integer,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index referral_links_tenant_idx on public.referral_links(tenant_id);

-- Opportunity fields : champs configurables par secteur
create table public.opportunity_fields (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  industry public.industry_code not null,
  key text not null,
  label text not null,
  type text not null check (type in ('text', 'number', 'select', 'date', 'boolean')),
  options jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  sort_order integer not null default 0,
  unique (tenant_id, key)
);

create index opportunity_fields_tenant_idx on public.opportunity_fields(tenant_id);

-- Opportunities : opportunités déclarées
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null,
  referrer_id uuid references public.profiles(id) on delete set null,
  assignee_id uuid references public.profiles(id) on delete set null,
  status public.opportunity_status not null default 'new',
  prospect_name text not null,
  prospect_email text,
  prospect_phone text,
  city text,
  address text,
  description text,
  estimated_value numeric(14, 2),
  urgency text check (urgency in ('low', 'medium', 'high')),
  comment text,
  custom_fields jsonb not null default '{}'::jsonb,
  closed_value numeric(14, 2),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index opportunities_tenant_idx on public.opportunities(tenant_id);
create index opportunities_referrer_idx on public.opportunities(referrer_id);
create index opportunities_assignee_idx on public.opportunities(assignee_id);
create index opportunities_status_idx on public.opportunities(status);

-- Opportunity status history : audit trail
create table public.opportunity_status_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  from_status public.opportunity_status,
  to_status public.opportunity_status not null,
  note text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index opportunity_status_history_oid_idx on public.opportunity_status_history(opportunity_id);

-- Commission rules : configuration des commissions
create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  type public.commission_rule_type not null,
  base public.commission_base not null,
  fixed_amount numeric(14, 2),
  percentage numeric(5, 2),
  tiers jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index commission_rules_tenant_idx on public.commission_rules(tenant_id);

-- Commissions : commissions calculées
create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  rule_id uuid references public.commission_rules(id) on delete set null,
  status public.commission_status not null default 'estimated',
  amount numeric(14, 2) not null,
  base_amount numeric(14, 2),
  notes text,
  due_at timestamptz,
  paid_at timestamptz,
  validated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index commissions_tenant_idx on public.commissions(tenant_id);
create index commissions_referrer_idx on public.commissions(referrer_id);
create index commissions_status_idx on public.commissions(status);

-- Documents : pièces jointes
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  uploader_id uuid references public.profiles(id) on delete set null,
  file_name text not null,
  file_path text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index documents_tenant_idx on public.documents(tenant_id);

-- Subscriptions : abonnements (Stripe à intégrer plus tard)
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan public.subscription_plan not null,
  status public.subscription_status not null default 'trialing',
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_tenant_idx on public.subscriptions(tenant_id);

-- Invitations : invitations par email
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role public.app_role not null check (role <> 'super_admin'),
  token text not null unique,
  accepted_at timestamptz,
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index invitations_tenant_idx on public.invitations(tenant_id);
create index invitations_email_idx on public.invitations(email);

-- =====================================================================
-- TRIGGERS : updated_at automatique
-- =====================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

create trigger tenant_members_set_updated_at
  before update on public.tenant_members
  for each row execute function public.set_updated_at();

create trigger programs_set_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();

create trigger opportunities_set_updated_at
  before update on public.opportunities
  for each row execute function public.set_updated_at();

create trigger commissions_set_updated_at
  before update on public.commissions
  for each row execute function public.set_updated_at();

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- =====================================================================
-- TRIGGER : crée un profil à l'inscription
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- TRIGGER : génère un code de parrainage pour les apporteurs
-- =====================================================================

create or replace function public.set_referral_code()
returns trigger
language plpgsql
as $$
declare
  candidate text;
  attempts int := 0;
begin
  if new.role = 'referrer' and new.referral_code is null then
    loop
      candidate := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
      begin
        new.referral_code := candidate;
        exit;
      exception when unique_violation then
        attempts := attempts + 1;
        if attempts > 5 then
          raise exception 'Impossible de générer un referral_code unique';
        end if;
      end;
    end loop;
  end if;
  return new;
end;
$$;

create trigger tenant_members_set_referral_code
  before insert on public.tenant_members
  for each row execute function public.set_referral_code();

-- =====================================================================
-- TRIGGER : historise les changements de statut d'opportunité
-- =====================================================================

create or replace function public.log_opportunity_status_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.opportunity_status_history (opportunity_id, tenant_id, to_status, changed_by)
    values (new.id, new.tenant_id, new.status, auth.uid());
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.opportunity_status_history (opportunity_id, tenant_id, from_status, to_status, changed_by)
    values (new.id, new.tenant_id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger opportunities_status_change
  after insert or update of status on public.opportunities
  for each row execute function public.log_opportunity_status_change();
