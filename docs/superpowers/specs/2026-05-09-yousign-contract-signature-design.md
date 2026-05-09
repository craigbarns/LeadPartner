# Yousign Contract Signature — Design Spec

**Date:** 2026-05-09
**Status:** Approved (ready for implementation plan)
**Author:** Gregory Baranes

## Context

LeadPartner is a multi-tenant Next.js + Supabase SaaS for managing referrers (apporteurs d'affaires) and commissions across 8 industry verticals (`real_estate`, `construction`, `insurance`, `credit`, `automotive`, `training`, `b2b_services`, `other`).

Today, an admin invites a referrer via `/team/invite` → the referrer accepts the invite → they immediately access the dashboard and can generate referral links. **No legal contract is signed**, which is a problem because:

- For regulated industries (real estate under loi Hoguet, insurance/credit under ORIAS), unsigned contracts may make commissions legally contestable or be requalified as undeclared work.
- Even for unregulated industries, written agreement is best practice for commission-based work.

We integrate **Yousign** (eIDAS-compliant electronic signature) to require a signed contract before a referrer becomes operational.

## Goals

- A referrer **cannot access the dashboard** until their contract is signed (blocking flow).
- Contract is **auto-generated per tenant industry** with industry-specific legal clauses.
- Signature uses **Yousign Standard level** (email click, eIDAS-compliant, no SMS OTP cost).
- Admin gets a manual override to mark a contract as "signed offline" (for paper exceptions).
- Signed PDFs are archived in private Supabase Storage.

## Non-Goals

- Multi-signer workflows beyond admin → referrer (2 signers max).
- Contract templates editable per tenant in-app (industry-default templates only for v1).
- Support for legal entities, freelancers, or salaried referrers (v1 targets **individual occasional referrers** only — `particuliers occasionnels`).
- Contract amendments / versioning workflow (v1: one active contract per `(tenant, member)`; renewal creates a new contract).
- Internationalization (FR-only for v1).

## Scope Boundary

This spec covers the signature integration. Out of scope:
- Tax declaration tooling (IFU generation) — separate project.
- Background checks / KYC of referrers — separate project.
- Multi-language contract templates — separate project.

## User Flow

```
1. Admin invites referrer (existing flow)
   └─→ /team/invite → email sent

2. Referrer clicks email link
   └─→ /invite/[token] → signup (existing)

3. NEW: "Complete your information" step
   └─→ /onboarding/referrer
       Form: birth info, address, phone, social security number, IBAN
       (HTTPS, clear RGPD notices)

4. NEW: Contract generation + signature
   └─→ /sign/[contractId]
       a. Backend generates personalized PDF from industry template
          (admin's name, role and tenant info already baked into the PDF
          as the issuing party — no admin Yousign signature needed)
       b. Creates Yousign signature request with **referrer as sole signer**
       c. Page displays: "Your contract is ready. Sign with Yousign"
       d. "Sign now" button → opens Yousign embedded iframe
          (or redirects to Yousign hosted page)

5. Referrer signs on Yousign (click + email link)
   └─→ Yousign → webhook to our app → marks contract.status = 'signed'
   └─→ Webhook fetches signed PDF and stores in Supabase Storage

6. Referrer returns to app → middleware detects signed contract
   └─→ Dashboard access unlocked

7. Admin side
   └─→ /team/[memberId] shows "Contract signed on YYYY-MM-DD - View PDF"
   └─→ "Mark as signed offline" override button
```

## Data Model Changes

### New table: `contracts`

```sql
create type public.contract_status as enum (
  'draft',
  'pending_info',     -- awaiting referrer's missing info
  'sent',             -- sent to Yousign, awaiting signature
  'signed',
  'declined',
  'expired',
  'canceled'
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  member_id uuid not null references public.tenant_members(id) on delete cascade,
  status public.contract_status not null default 'draft',

  -- Yousign references
  yousign_signature_request_id text unique,
  yousign_document_id text,

  -- PDF storage paths (Supabase Storage)
  unsigned_pdf_path text,
  signed_pdf_path text,

  -- Snapshot of variables at generation time (immutable after send)
  contract_data jsonb not null default '{}'::jsonb,

  -- Lifecycle timestamps
  sent_at timestamptz,
  signed_at timestamptz,
  expires_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only one active contract per (tenant, member). "Active" = not canceled/expired.
create unique index contracts_active_unique
  on public.contracts (tenant_id, member_id)
  where status in ('draft', 'pending_info', 'sent', 'signed');

create index contracts_yousign_id on public.contracts (yousign_signature_request_id);
create index contracts_status on public.contracts (tenant_id, status);
```

### New table: `yousign_events` (for webhook idempotency)

```sql
create table public.yousign_events (
  id uuid primary key default gen_random_uuid(),
  yousign_event_id text not null unique,
  event_type text not null,
  signature_request_id text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
```

### Profile additions (referrer info for contract)

```sql
alter table public.profiles
  add column birth_date date,
  add column birth_place text,
  add column nationality text default 'Française',
  add column address text,
  add column postal_code text,
  add column city text,
  add column country text default 'France',
  add column phone text,
  add column social_security_number_encrypted bytea,  -- AES-256-GCM
  add column iban_encrypted bytea,
  add column bic text;
```

### Tenant additions (legal info for contract)

```sql
alter table public.tenants
  add column legal_name text,
  add column legal_form text,         -- 'SAS', 'SARL', 'SASU', 'EI'...
  add column siret text,
  add column rcs_city text,
  add column capital numeric,
  add column legal_address text,
  add column representative_name text,
  add column representative_role text,  -- 'Président', 'Gérant', 'Directeur Général'

  -- Industry-specific (nullable, populated as relevant)
  add column carte_t_number text,        -- real_estate
  add column carte_t_city text,
  add column caisse_garantie text,
  add column orias_number text;          -- insurance, credit
```

### RLS Policies

```sql
alter table public.contracts enable row level security;

-- Admin: see all contracts of their tenant
create policy contracts_admin_select on public.contracts
  for select using (public.is_admin_of(tenant_id));

-- Admin: insert/update contracts in their tenant
create policy contracts_admin_write on public.contracts
  for all using (public.is_admin_of(tenant_id));

-- Referrer: see only their own contract
create policy contracts_member_select on public.contracts
  for select using (
    member_id in (
      select id from public.tenant_members
      where user_id = auth.uid()
    )
  );

-- yousign_events: service role only (webhook handler uses service role)
alter table public.yousign_events enable row level security;
-- No policies → only service role can access
```

## Architecture

### New files

```
src/lib/contracts/
├── templates/
│   ├── base.tsx              # Shared React-PDF layout
│   ├── real-estate.tsx
│   ├── insurance.tsx
│   ├── credit.tsx
│   ├── construction.tsx
│   ├── automotive.tsx
│   ├── training.tsx
│   ├── b2b-services.tsx
│   └── other.tsx
├── clauses/
│   ├── common.ts             # RGPD, confidentiality, duration, jurisdiction
│   └── industry-specific.ts  # Per-industry legal clauses
├── generator.ts              # generateContractPDF(tenant, member, rule) → Buffer
└── encryption.ts             # AES-256-GCM helpers for PII

src/lib/yousign/
├── client.ts                 # fetch wrapper for API v3 + auth
├── create-request.ts         # createSignatureRequest, addDocument, addSigners, activate
├── webhook.ts                # HMAC verification + event parsing
└── types.ts

src/app/api/contracts/
├── send/route.ts             # POST → generate PDF + send to Yousign
└── [id]/route.ts             # GET status, DELETE cancel

src/app/api/webhooks/yousign/route.ts   # POST events from Yousign

src/app/(app)/sign/[contractId]/page.tsx        # Referrer signature page
src/app/onboarding/referrer/page.tsx            # Missing info collection
src/app/(app)/team/[memberId]/page.tsx          # Admin contract status view
```

### Modified files

- `src/middleware.ts` — referrers with unsigned contracts redirected to `/sign/:id` (whitelist `/sign/*`, `/onboarding/referrer`, `/api/*`, `/auth/*`)
- `src/app/invite/[token]/accept-form.tsx` — after accept, redirect to `/onboarding/referrer`
- `src/types/database.ts` — regenerated from new schema

### Stack choices

- **PDF**: `@react-pdf/renderer` (TypeScript, server-side rendering, fits existing React stack)
- **Encryption**: Node `crypto` (AES-256-GCM) with `ENCRYPTION_KEY` (32 bytes base64) env var
- **Yousign API**: REST v3, custom fetch wrapper (no official SDK)
- **Trial sandbox**: `https://api-sandbox.yousign.app/v3`
- **Production**: `https://api.yousign.app/v3` (set via `YOUSIGN_API_BASE`)

### New environment variables

```
YOUSIGN_API_KEY              # Yousign API token
YOUSIGN_WEBHOOK_SECRET       # HMAC secret for webhook verification
YOUSIGN_API_BASE             # Default: https://api-sandbox.yousign.app/v3
ENCRYPTION_KEY               # 32 bytes base64, for IBAN/SSN encryption
ENABLE_CONTRACT_SIGNATURE    # Feature flag, default false
```

## Yousign API Flow (v3)

1. `POST /signature_requests` → returns `signature_request_id`
2. `POST /signature_requests/{id}/documents` (multipart with PDF) → returns `document_id`
3. `POST /signature_requests/{id}/signers` (one per signer with name, email, sign-zone coords)
4. `POST /signature_requests/{id}/activate` → triggers email to first signer
5. Webhook events received:
   - `signer.done` → one signer signed
   - `signature_request.done` → all signers signed → fetch signed PDF
   - `signer.declined` → mark as declined
   - `signature_request.expired` → mark as expired

Signed PDF retrieval: `GET /signature_requests/{id}/documents/{document_id}/download`

## Edge Cases

| Case | Behavior |
|---|---|
| Referrer declines signing | `status='declined'` → admin notified, can resend or remove |
| Referrer doesn't sign in 30 days | Yousign auto-expiration → webhook → `status='expired'` → admin can resend |
| Webhook received twice | Deduplicated by `yousign_event_id` in `yousign_events` table |
| Webhook arrives before DB record exists | Logged, return 200, Yousign won't retry; record check on next event |
| Tenant changes commission rules after send | Contract retains snapshot in `contract_data` — unaffected |
| Referrer wants to re-sign (expired contract) | "Renew" button → new contract row, new Yousign request |
| Admin deletes referrer post-signature | `tenant_member` soft-deleted, contract retained for legal archival (10 years) |
| Same person referrer at 2 tenants | One contract per tenant (unique index on active contracts per `(tenant, member)`) |
| Need to update admin's tenant legal info post-send | Sent contracts retain snapshot in `contract_data` ; new contracts use updated info |

## Security

- **Webhook signature**: every incoming webhook MUST have valid HMAC-SHA256 signature using `YOUSIGN_WEBHOOK_SECRET` ; reject with 401 otherwise
- **PII encryption**: IBAN and social security number encrypted at rest (AES-256-GCM) ; key from env, never in DB or logs
- **Storage**: signed PDFs in private Supabase Storage bucket `contracts-signed` ; access via signed URLs (TTL 1 hour)
- **RLS enforcement**: contracts visible only to admins of the tenant or the referrer themselves
- **Logs scrubbing**: never log SSN, IBAN, or full Yousign payloads with PII
- **RGPD**: explicit consent text in `/onboarding/referrer` ; data retention policy (10 years for signed contracts, immediate deletion of unsigned drafts on user request)

## Testing Strategy

### Unit tests

- `lib/contracts/generator.test.ts` — render PDF for each industry, assert presence of industry-specific clauses
- `lib/contracts/encryption.test.ts` — round-trip, missing key error, malformed ciphertext
- `lib/yousign/webhook.test.ts` — valid HMAC accepted, invalid rejected, malformed payload rejected
- `lib/yousign/client.test.ts` — request building, error response handling

### Integration tests

- Full flow: invite → signup → onboarding referrer → contract generation → mocked Yousign → webhook signed → middleware unlocks dashboard
- Webhook idempotency: same event ID twice → processed once
- Decline flow: webhook decline → status updates, admin sees it

### Manual sandbox tests

Performed against Yousign sandbox API with a real test inbox:

1. Sign a contract end-to-end as referrer
2. Verify signed PDF is downloaded into Supabase Storage and accessible via admin UI
3. Decline a contract — verify status transition and admin notification
4. Wait for expiration (or simulate via Yousign dashboard) — verify expired status

## Rollout

1. **Migration**: additive only (no breaking changes to existing tables)
2. **Feature flag**: `ENABLE_CONTRACT_SIGNATURE=false` initially → app behavior unchanged
3. **Sandbox testing**: enable flag in Vercel preview environment, test with self as referrer
4. **Production enable**: set flag in production after sandbox validation
5. **Monitoring**: Vercel logs on `/api/webhooks/yousign` and `/api/contracts/send` ; alert on 500s

## Open Questions

None at this time. All clarifications resolved during brainstorming session.

## Future Work (out of scope for v1)

- Multi-language templates (EN, ES) once internationalization is added to the app
- Per-tenant contract template editor (admin uploads custom PDF + maps fields)
- Support for freelancer / company referrers (additional KYC and contract clauses)
- Contract amendments and versioning history
- Bulk re-signing flow when commission rules change materially
- Integration with tax filing (IFU export from signed contracts)
