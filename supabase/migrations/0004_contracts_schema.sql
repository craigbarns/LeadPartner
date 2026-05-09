-- =====================================================================
-- Yousign contract signature — schema additions
-- =====================================================================

-- 1. Enums --------------------------------------------------------------

create type public.contract_status as enum (
  'draft',
  'pending_info',
  'sent',
  'signed',
  'declined',
  'expired',
  'canceled'
);

create type public.referrer_status as enum (
  'individual',
  'auto_entrepreneur',
  'company'
);

-- 2. Profile additions --------------------------------------------------
-- Note: profiles already has columns id, email, full_name, phone, avatar_url
-- so we don't re-add `phone` here.

alter table public.profiles
  add column referrer_status public.referrer_status,
  add column birth_date date,
  add column birth_place text,
  add column nationality text default 'Française',
  add column address text,
  add column postal_code text,
  add column city text,
  add column country text default 'France',
  add column iban_encrypted bytea,
  add column bic text,
  add column social_security_number_encrypted bytea,
  add column siret text,
  add column naf_code text,
  add column vat_number text,
  add column vat_applicable boolean default false,
  add column company_name text,
  add column legal_form text,
  add column rcs_city text,
  add column capital numeric,
  add column legal_representative_name text,
  add column legal_representative_role text;

-- 3. Tenant additions ---------------------------------------------------

alter table public.tenants
  add column legal_name text,
  add column legal_form text,
  add column siret text,
  add column rcs_city text,
  add column capital numeric,
  add column legal_address text,
  add column representative_name text,
  add column representative_role text,
  add column carte_t_number text,
  add column carte_t_city text,
  add column caisse_garantie text,
  add column orias_number text;

-- 4. Contracts table ----------------------------------------------------

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  member_id uuid not null references public.tenant_members(id) on delete cascade,
  status public.contract_status not null default 'draft',

  yousign_signature_request_id text unique,
  yousign_document_id text,

  unsigned_pdf_path text,
  signed_pdf_path text,

  contract_data jsonb not null default '{}'::jsonb,

  sent_at timestamptz,
  signed_at timestamptz,
  expires_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index contracts_active_unique
  on public.contracts (tenant_id, member_id)
  where status in ('draft', 'pending_info', 'sent', 'signed');

create index contracts_yousign_id on public.contracts (yousign_signature_request_id);
create index contracts_status on public.contracts (tenant_id, status);

-- 5. Yousign events log (idempotency) -----------------------------------

create table public.yousign_events (
  id uuid primary key default gen_random_uuid(),
  yousign_event_id text not null unique,
  event_type text not null,
  signature_request_id text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- 6. updated_at trigger -------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger contracts_set_updated_at
  before update on public.contracts
  for each row execute function public.set_updated_at();
