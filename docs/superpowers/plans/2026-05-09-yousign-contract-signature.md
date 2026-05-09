# Yousign Contract Signature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block referrer access to the dashboard until they have electronically signed an industry- and status-specific contract via Yousign.

**Architecture:** New `contracts` table, Supabase migration adding fields to `profiles` and `tenants`, AES-256-GCM encryption for PII, server-side PDF generation with `@react-pdf/renderer`, Yousign API v3 integration with HMAC-verified webhooks, Next.js middleware guard on referrer routes.

**Tech Stack:** Next.js 15, Supabase (Postgres + Auth + Storage + RLS), TypeScript, Zod, React Hook Form, `@react-pdf/renderer`, Vitest (new), Yousign REST API v3.

**Reference spec:** `docs/superpowers/specs/2026-05-09-yousign-contract-signature-design.md`

---

## Phase 1 — Foundation

### Task 1: Install dependencies and set up testing

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Install runtime deps**

```bash
npm install @react-pdf/renderer
```

- [ ] **Step 2: Install dev deps**

```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Create vitest config**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 4: Create test setup**

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 5: Add test scripts**

In `package.json` `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verify**

Run: `npm test`
Expected: "No test files found, exiting with code 0" or similar success message.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/test/setup.ts
git commit -m "chore: add Vitest testing setup and React-PDF dependency"
```

---

### Task 2: Add environment variable schema

**Files:**
- Create: `src/lib/env.ts`
- Modify: `.env.example`

- [ ] **Step 1: Create env validator**

`src/lib/env.ts`:
```ts
import { z } from 'zod'

const ServerEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Yousign
  YOUSIGN_API_KEY: z.string().min(1).optional(),
  YOUSIGN_WEBHOOK_SECRET: z.string().min(1).optional(),
  YOUSIGN_API_BASE: z.string().url().default('https://api-sandbox.yousign.app/v3'),

  // Encryption
  ENCRYPTION_KEY: z.string().regex(/^[A-Za-z0-9+/=]+$/).optional(),

  // Feature flags
  ENABLE_CONTRACT_SIGNATURE: z.enum(['true', 'false']).default('false'),
})

export const serverEnv = ServerEnvSchema.parse(process.env)

export const isContractSignatureEnabled = () =>
  serverEnv.ENABLE_CONTRACT_SIGNATURE === 'true'
```

- [ ] **Step 2: Update .env.example**

Append to `.env.example`:
```
# Yousign (electronic signature)
# Sandbox base for trial accounts: https://api-sandbox.yousign.app/v3
# Production base: https://api.yousign.app/v3
YOUSIGN_API_KEY=
YOUSIGN_WEBHOOK_SECRET=
YOUSIGN_API_BASE=https://api-sandbox.yousign.app/v3

# 32 bytes base64 — generate with: openssl rand -base64 32
ENCRYPTION_KEY=

# Feature flag (set to "true" to activate the signature flow)
ENABLE_CONTRACT_SIGNATURE=false
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/env.ts .env.example
git commit -m "feat: add server env schema and contract signature feature flag"
```

---

### Task 3: Database migration — schema additions

**Files:**
- Create: `supabase/migrations/0004_contracts_schema.sql`

- [ ] **Step 1: Write migration**

`supabase/migrations/0004_contracts_schema.sql`:
```sql
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

alter table public.profiles
  add column referrer_status public.referrer_status,
  add column birth_date date,
  add column birth_place text,
  add column nationality text default 'Française',
  add column address text,
  add column postal_code text,
  add column city text,
  add column country text default 'France',
  add column phone text,
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
```

- [ ] **Step 2: Apply migration via Supabase SQL Editor**

Copy the file contents and run in Supabase Dashboard → SQL Editor.

- [ ] **Step 3: Verify**

In Supabase → Table Editor, confirm:
- New table `contracts` exists
- New table `yousign_events` exists
- `profiles` has new columns (`referrer_status`, `birth_date`, etc.)
- `tenants` has new columns (`legal_name`, `siret`, etc.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0004_contracts_schema.sql
git commit -m "feat(db): add contracts table and PII columns for signature flow"
```

---

### Task 4: Database migration — RLS policies

**Files:**
- Create: `supabase/migrations/0005_contracts_rls.sql`

- [ ] **Step 1: Write migration**

`supabase/migrations/0005_contracts_rls.sql`:
```sql
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
```

- [ ] **Step 2: Apply migration**

Run in Supabase SQL Editor.

- [ ] **Step 3: Verify in Supabase**

Authentication → Policies:
- `contracts` table shows `contracts_admin_all` and `contracts_member_select`
- `yousign_events` shows "RLS enabled" with no policies

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_contracts_rls.sql
git commit -m "feat(db): add RLS policies for contracts table"
```

---

### Task 5: Storage bucket for signed PDFs

**Files:**
- Create: `supabase/migrations/0006_storage_bucket.sql`

- [ ] **Step 1: Write migration**

`supabase/migrations/0006_storage_bucket.sql`:
```sql
-- =====================================================================
-- Private bucket for signed contract PDFs
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('contracts-signed', 'contracts-signed', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('contracts-unsigned', 'contracts-unsigned', false)
on conflict (id) do nothing;

-- Admins can read signed contracts of their tenant.
-- Path convention: <tenant_id>/<contract_id>.pdf
create policy "Admins read signed contracts"
  on storage.objects for select
  using (
    bucket_id = 'contracts-signed'
    and exists (
      select 1 from public.contracts c
      where c.signed_pdf_path = name
        and public.is_admin_of(c.tenant_id)
    )
  );

create policy "Referrer reads own signed contract"
  on storage.objects for select
  using (
    bucket_id = 'contracts-signed'
    and exists (
      select 1 from public.contracts c
      join public.tenant_members tm on tm.id = c.member_id
      where c.signed_pdf_path = name
        and tm.user_id = auth.uid()
    )
  );

-- Service role has full access by default — no policy needed for inserts.
```

- [ ] **Step 2: Apply migration**

Run in Supabase SQL Editor.

- [ ] **Step 3: Verify**

Supabase → Storage → confirm buckets `contracts-signed` and `contracts-unsigned` exist and are private.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0006_storage_bucket.sql
git commit -m "feat(db): add private storage buckets for contract PDFs"
```

---

### Task 6: Regenerate database types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Regenerate types**

Run (replacing `<project-ref>`):
```bash
npx supabase gen types typescript --project-id <project-ref> --schema public > src/types/database.ts
```

(Or manually update the file to add the new tables/columns/enums if no Supabase CLI access — see schema in Task 3 for the shape.)

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "chore: regenerate database types after contracts schema"
```

---

## Phase 2 — Encryption Library

### Task 7: AES-256-GCM encryption helpers (TDD)

**Files:**
- Create: `src/lib/contracts/encryption.ts`
- Test: `src/lib/contracts/encryption.test.ts`

- [ ] **Step 1: Write failing test**

`src/lib/contracts/encryption.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { encrypt, decrypt } from './encryption'

beforeAll(() => {
  // 32 bytes base64
  process.env.ENCRYPTION_KEY = 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU='
})

describe('encryption', () => {
  it('round-trips a string', () => {
    const plain = 'FR7630006000011234567890189'
    const encrypted = encrypt(plain)
    expect(encrypted).toBeInstanceOf(Buffer)
    expect(decrypt(encrypted)).toBe(plain)
  })

  it('produces different ciphertexts for the same input (random IV)', () => {
    const a = encrypt('same')
    const b = encrypt('same')
    expect(a.equals(b)).toBe(false)
    expect(decrypt(a)).toBe('same')
    expect(decrypt(b)).toBe('same')
  })

  it('throws when ENCRYPTION_KEY is missing', () => {
    const original = process.env.ENCRYPTION_KEY
    delete process.env.ENCRYPTION_KEY
    expect(() => encrypt('x')).toThrow(/ENCRYPTION_KEY/)
    process.env.ENCRYPTION_KEY = original
  })

  it('throws on tampered ciphertext', () => {
    const ct = encrypt('hello')
    ct[ct.length - 1] ^= 0xff
    expect(() => decrypt(ct)).toThrow()
  })
})
```

- [ ] **Step 2: Run test (should fail — module not found)**

Run: `npx vitest run src/lib/contracts/encryption.test.ts`
Expected: FAIL — `Cannot find module './encryption'`

- [ ] **Step 3: Implement**

`src/lib/contracts/encryption.ts`:
```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error('ENCRYPTION_KEY env var is required')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (base64-encoded)')
  }
  return key
}

// Layout: [iv (12)] [tag (16)] [ciphertext (n)]
export function encrypt(plaintext: string): Buffer {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext])
}

export function decrypt(payload: Buffer): string {
  if (payload.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid encrypted payload')
  }
  const iv = payload.subarray(0, IV_LENGTH)
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
```

- [ ] **Step 4: Run test (should pass)**

Run: `npx vitest run src/lib/contracts/encryption.test.ts`
Expected: 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/contracts/encryption.ts src/lib/contracts/encryption.test.ts
git commit -m "feat(contracts): add AES-256-GCM encryption for PII"
```

---

## Phase 3 — PDF Generation

### Task 8: Contract data type and snapshot builder

**Files:**
- Create: `src/lib/contracts/types.ts`
- Create: `src/lib/contracts/snapshot.ts`
- Test: `src/lib/contracts/snapshot.test.ts`

- [ ] **Step 1: Define types**

`src/lib/contracts/types.ts`:
```ts
import type { Database } from '@/types/database'

export type IndustryCode = Database['public']['Enums']['industry_code']
export type ReferrerStatus = Database['public']['Enums']['referrer_status']

export interface TenantSnapshot {
  legal_name: string
  legal_form: string
  siret: string
  rcs_city: string
  capital: number
  legal_address: string
  representative_name: string
  representative_role: string
  industry: IndustryCode
  carte_t_number?: string
  carte_t_city?: string
  caisse_garantie?: string
  orias_number?: string
  primary_color?: string
  logo_url?: string
}

export interface IndividualSnapshot {
  status: 'individual'
  first_name: string
  last_name: string
  email: string
  birth_date: string
  birth_place: string
  nationality: string
  address: string
  postal_code: string
  city: string
  country: string
  phone: string
  social_security_number_masked: string  // last 4 digits only
  iban_masked: string                     // last 4 digits only
}

export interface AutoEntrepreneurSnapshot {
  status: 'auto_entrepreneur'
  first_name: string
  last_name: string
  email: string
  birth_date: string
  address: string
  postal_code: string
  city: string
  country: string
  phone: string
  siret: string
  naf_code: string
  vat_applicable: boolean
  vat_number?: string
  iban_masked: string
}

export interface CompanySnapshot {
  status: 'company'
  email: string
  phone: string
  company_name: string
  legal_form: string
  siret: string
  rcs_city: string
  capital: number
  address: string
  postal_code: string
  city: string
  country: string
  vat_applicable: boolean
  vat_number?: string
  legal_representative_name: string
  legal_representative_role: string
  iban_masked: string
}

export type ReferrerSnapshot =
  | IndividualSnapshot
  | AutoEntrepreneurSnapshot
  | CompanySnapshot

export interface CommissionRuleSnapshot {
  name: string
  type: 'fixed' | 'percentage' | 'tiered'
  base: 'contract_amount' | 'fees' | 'signed_quote' | 'collected_revenue'
  percentage?: number
  fixed_amount?: number
  tiers?: Array<{ from: number; to: number | null; rate: number }>
}

export interface ContractSnapshot {
  generated_at: string  // ISO date
  tenant: TenantSnapshot
  referrer: ReferrerSnapshot
  commission_rule: CommissionRuleSnapshot
  contract_duration_months: number  // default 12
  jurisdiction_city: string         // default tenant.rcs_city
}
```

- [ ] **Step 2: Write failing test for snapshot builder**

`src/lib/contracts/snapshot.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { maskIban, maskSSN } from './snapshot'

describe('snapshot helpers', () => {
  it('masks IBAN to last 4 digits', () => {
    expect(maskIban('FR7630006000011234567890189')).toBe('FR**** **** **** 0189')
  })

  it('masks SSN to last 4 digits', () => {
    expect(maskSSN('1850275123456 78')).toBe('***********56 78')
  })

  it('handles short input gracefully', () => {
    expect(maskIban('ABC')).toBe('****')
    expect(maskSSN('1')).toBe('****')
  })
})
```

- [ ] **Step 3: Run test (should fail)**

Run: `npx vitest run src/lib/contracts/snapshot.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement**

`src/lib/contracts/snapshot.ts`:
```ts
export function maskIban(iban: string): string {
  const cleaned = iban.replace(/\s+/g, '')
  if (cleaned.length < 8) return '****'
  const last4 = cleaned.slice(-4)
  const cc = cleaned.slice(0, 2)
  return `${cc}**** **** **** ${last4}`
}

export function maskSSN(ssn: string): string {
  const cleaned = ssn.replace(/\s+/g, '')
  if (cleaned.length < 8) return '****'
  const last4 = cleaned.slice(-4)
  return `${'*'.repeat(cleaned.length - 4)}${last4.slice(0, 2)} ${last4.slice(2)}`
}
```

- [ ] **Step 5: Run test (should pass)**

Run: `npx vitest run src/lib/contracts/snapshot.test.ts`
Expected: 3 tests passing

- [ ] **Step 6: Commit**

```bash
git add src/lib/contracts/types.ts src/lib/contracts/snapshot.ts src/lib/contracts/snapshot.test.ts
git commit -m "feat(contracts): add snapshot types and PII masking helpers"
```

---

### Task 9: Common contract clauses

**Files:**
- Create: `src/lib/contracts/clauses/common.ts`

- [ ] **Step 1: Implement common clauses**

`src/lib/contracts/clauses/common.ts`:
```ts
export const COMMON_CLAUSES = {
  preamble: (tenantName: string) =>
    `Le présent contrat d'apport d'affaires (ci-après le « Contrat ») est conclu entre les parties désignées ci-dessous afin de définir les modalités de leur collaboration dans le cadre de l'apport d'opportunités commerciales à la société ${tenantName}.`,

  duration: (months: number) =>
    `Le présent Contrat est conclu pour une durée de ${months} mois à compter de sa signature, renouvelable tacitement par périodes équivalentes sauf dénonciation par l'une des parties moyennant un préavis de trente (30) jours par lettre recommandée avec accusé de réception.`,

  confidentiality: () =>
    `Chacune des parties s'engage à conserver strictement confidentielles toutes les informations échangées dans le cadre du présent Contrat. Cette obligation de confidentialité subsiste pendant cinq (5) ans après la fin du Contrat.`,

  exclusivity: () =>
    `Le présent Contrat n'emporte aucune exclusivité. Chacune des parties demeure libre de poursuivre ses activités auprès d'autres partenaires sous réserve du respect des obligations de confidentialité ci-dessus.`,

  rgpd: (tenantName: string) =>
    `Conformément au Règlement (UE) 2016/679 (RGPD), les données personnelles collectées dans le cadre du présent Contrat sont traitées par ${tenantName} aux fins exclusives de l'exécution du Contrat et de ses obligations légales. L'Apporteur dispose d'un droit d'accès, de rectification, d'effacement et de portabilité de ses données, qu'il peut exercer en contactant le responsable de traitement par courrier ou par email. Les données sont conservées pour la durée légale applicable aux contrats commerciaux (10 ans).`,

  jurisdiction: (city: string) =>
    `Le présent Contrat est régi par le droit français. Tout litige relatif à son interprétation ou à son exécution sera de la compétence exclusive des tribunaux compétents de ${city}.`,

  termination: () =>
    `Le présent Contrat peut être résilié de plein droit par l'une ou l'autre des parties en cas de manquement grave de l'autre partie à ses obligations, après mise en demeure restée infructueuse pendant trente (30) jours.`,
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/contracts/clauses/common.ts
git commit -m "feat(contracts): add common contract clauses (RGPD, duration, jurisdiction)"
```

---

### Task 10: Industry-specific clauses

**Files:**
- Create: `src/lib/contracts/clauses/industry.ts`

- [ ] **Step 1: Implement industry clauses**

`src/lib/contracts/clauses/industry.ts`:
```ts
import type { IndustryCode, TenantSnapshot } from '../types'

export interface IndustryClauseSet {
  object: string
  legal_mentions: string
  obligations: string
}

export function getIndustryClauses(
  industry: IndustryCode,
  tenant: TenantSnapshot,
): IndustryClauseSet {
  switch (industry) {
    case 'real_estate':
      return {
        object: `L'Apporteur s'engage à signaler à la Société des opportunités d'affaires en lien avec son activité de transactions et/ou de gestion immobilière. L'Apporteur n'est pas autorisé à intervenir dans les négociations commerciales, ni à présenter les biens, ni à percevoir directement des fonds des prospects.`,
        legal_mentions: tenant.carte_t_number
          ? `La Société est titulaire de la carte professionnelle n° ${tenant.carte_t_number} délivrée par la CCI de ${tenant.carte_t_city ?? '[ville]'}, garantie financière auprès de ${tenant.caisse_garantie ?? '[organisme]'}, conformément aux dispositions de la loi n° 70-9 du 2 janvier 1970 (loi Hoguet) et de son décret d'application n° 72-678 du 20 juillet 1972.`
          : `La Société exerce son activité conformément aux dispositions de la loi n° 70-9 du 2 janvier 1970 (loi Hoguet).`,
        obligations: `L'Apporteur reconnaît que toute activité d'entremise immobilière (négociation, présentation, perception de fonds) est strictement réservée aux titulaires de la carte professionnelle. Son rôle se limite à la mise en relation initiale.`,
      }

    case 'insurance':
      return {
        object: `L'Apporteur s'engage à signaler à la Société des opportunités de souscription de contrats d'assurance.`,
        legal_mentions: tenant.orias_number
          ? `La Société est immatriculée à l'ORIAS sous le n° ${tenant.orias_number} en qualité de courtier d'assurance. Cette immatriculation peut être vérifiée sur le site www.orias.fr.`
          : `La Société exerce son activité conformément au Code des assurances.`,
        obligations: `L'Apporteur n'est pas autorisé à présenter, proposer ou aider à conclure des contrats d'assurance, activités strictement réservées aux intermédiaires immatriculés à l'ORIAS. Son rôle se limite à la mise en relation initiale.`,
      }

    case 'credit':
      return {
        object: `L'Apporteur s'engage à signaler à la Société des opportunités de financement (crédit immobilier, crédit à la consommation, regroupement de crédits, financement professionnel).`,
        legal_mentions: tenant.orias_number
          ? `La Société est immatriculée à l'ORIAS sous le n° ${tenant.orias_number} en qualité d'IOBSP (Intermédiaire en Opérations de Banque et Services de Paiement). Cette immatriculation peut être vérifiée sur le site www.orias.fr.`
          : `La Société exerce son activité conformément au Code monétaire et financier.`,
        obligations: `L'Apporteur n'est pas autorisé à présenter ou faire souscrire des opérations de banque ou de services de paiement, activités strictement réservées aux IOBSP immatriculés à l'ORIAS. Son rôle se limite à la mise en relation initiale.`,
      }

    case 'construction':
      return {
        object: `L'Apporteur s'engage à signaler à la Société des opportunités de chantiers (rénovation, construction neuve, extension, aménagement).`,
        legal_mentions: `La Société dispose des assurances professionnelles requises (responsabilité civile professionnelle, garantie décennale).`,
        obligations: `L'Apporteur ne peut pas chiffrer les travaux, signer un devis au nom de la Société, ni percevoir d'acompte.`,
      }

    case 'automotive':
      return {
        object: `L'Apporteur s'engage à signaler à la Société des opportunités liées à l'achat, la vente ou le financement de véhicules.`,
        legal_mentions: `La Société exerce son activité conformément aux dispositions du Code de la consommation.`,
        obligations: `L'Apporteur ne peut pas conclure de vente, signer de bon de commande, ni percevoir d'acompte au nom de la Société.`,
      }

    case 'training':
      return {
        object: `L'Apporteur s'engage à signaler à la Société des opportunités de formation professionnelle (entreprises ou particuliers).`,
        legal_mentions: `La Société est déclarée organisme de formation conformément aux articles L.6351-1 et suivants du Code du travail.`,
        obligations: `L'Apporteur ne peut pas négocier de programme de formation, signer de convention, ni encaisser de frais pédagogiques.`,
      }

    case 'b2b_services':
      return {
        object: `L'Apporteur s'engage à signaler à la Société des opportunités commerciales B2B en lien avec ses prestations de services.`,
        legal_mentions: `La Société exerce son activité conformément aux dispositions du Code de commerce et du Code civil.`,
        obligations: `L'Apporteur n'est pas habilité à engager la Société sur le périmètre, les délais ou le prix des prestations.`,
      }

    case 'other':
    default:
      return {
        object: `L'Apporteur s'engage à signaler à la Société des opportunités commerciales relevant de son activité.`,
        legal_mentions: `La Société exerce son activité conformément à la réglementation française applicable à son secteur.`,
        obligations: `L'Apporteur n'est pas habilité à engager la Société et son rôle se limite à la mise en relation initiale.`,
      }
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/contracts/clauses/industry.ts
git commit -m "feat(contracts): add industry-specific contract clauses for 8 verticals"
```

---

### Task 11: Status-specific clauses

**Files:**
- Create: `src/lib/contracts/clauses/status.ts`

- [ ] **Step 1: Implement**

`src/lib/contracts/clauses/status.ts`:
```ts
import type { ReferrerStatus } from '../types'

export interface StatusClauseSet {
  party_qualifier: string         // appended to "L'Apporteur, ..."
  remuneration_addendum: string
  signature_block_label: string
}

export function getStatusClauses(status: ReferrerStatus): StatusClauseSet {
  switch (status) {
    case 'individual':
      return {
        party_qualifier: `agissant à titre personnel à titre occasionnel, ci-après dénommé l'« Apporteur »`,
        remuneration_addendum: `L'Apporteur déclare exercer cette activité à titre occasionnel, ne dépassant pas trois (3) opérations par année civile. Au-delà, les parties conviennent qu'une régularisation sera nécessaire (immatriculation en tant qu'auto-entrepreneur ou société). Conformément à la réglementation, la Société établira chaque année un Imprimé Fiscal Unique (IFU) déclarant les commissions versées.`,
        signature_block_label: `Lu et approuvé, signé par l'Apporteur`,
      }

    case 'auto_entrepreneur':
      return {
        party_qualifier: `auto-entrepreneur, ci-après dénommé l'« Apporteur »`,
        remuneration_addendum: `L'Apporteur établira mensuellement une facture pour les commissions dues, conformément à son régime de micro-entreprise. La franchise en base de TVA s'applique, sauf si l'Apporteur a opté pour l'assujettissement à la TVA, auquel cas son numéro de TVA intracommunautaire figurera sur ses factures.`,
        signature_block_label: `Lu et approuvé, signé par l'Apporteur (auto-entrepreneur)`,
      }

    case 'company':
      return {
        party_qualifier: `agissant en qualité de représentant légal dûment habilité, ci-après dénommée la « Société Apporteuse »`,
        remuneration_addendum: `La Société Apporteuse établira mensuellement une facture pour les commissions dues, conformément à ses obligations comptables et fiscales. La TVA sera applicable au taux en vigueur.`,
        signature_block_label: `Pour la Société Apporteuse, son représentant légal`,
      }
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/contracts/clauses/status.ts
git commit -m "feat(contracts): add status-specific clauses (individual/AE/company)"
```

---

### Task 12: PDF template (React-PDF)

**Files:**
- Create: `src/lib/contracts/template.tsx`

- [ ] **Step 1: Create template**

`src/lib/contracts/template.tsx`:
```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { ContractSnapshot } from './types'
import { COMMON_CLAUSES } from './clauses/common'
import { getIndustryClauses } from './clauses/industry'
import { getStatusClauses } from './clauses/status'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', lineHeight: 1.5 },
  title: { fontSize: 16, marginBottom: 16, textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  h2: { fontSize: 12, marginTop: 14, marginBottom: 6, fontFamily: 'Helvetica-Bold' },
  paragraph: { marginBottom: 6, textAlign: 'justify' },
  party: { marginBottom: 8 },
  partyLabel: { fontFamily: 'Helvetica-Bold' },
  signatureRow: { marginTop: 30, flexDirection: 'row', justifyContent: 'space-between' },
  signatureBox: { width: '45%', borderTop: 1, paddingTop: 6 },
  small: { fontSize: 8, color: '#666' },
})

function PartiesSection({ snapshot }: { snapshot: ContractSnapshot }) {
  const { tenant, referrer } = snapshot
  const status = getStatusClauses(referrer.status)

  return (
    <View>
      <Text style={styles.h2}>1. Parties</Text>

      <View style={styles.party}>
        <Text style={styles.partyLabel}>La Société :</Text>
        <Text>
          {tenant.legal_name}, {tenant.legal_form} au capital de {tenant.capital}€,
          immatriculée au RCS de {tenant.rcs_city} sous le n° {tenant.siret},
          dont le siège social est sis {tenant.legal_address},
          représentée par {tenant.representative_name}, en sa qualité de {tenant.representative_role},
          dûment habilité.
        </Text>
        <Text>Ci-après dénommée la « Société ».</Text>
      </View>

      <View style={styles.party}>
        <Text style={styles.partyLabel}>L'Apporteur :</Text>
        {referrer.status === 'individual' && (
          <Text>
            {referrer.first_name} {referrer.last_name}, né(e) le {referrer.birth_date} à {referrer.birth_place},
            de nationalité {referrer.nationality}, demeurant {referrer.address}, {referrer.postal_code} {referrer.city}, {referrer.country},
            tél. {referrer.phone}, email {referrer.email}.
            {' '}{status.party_qualifier}.
          </Text>
        )}
        {referrer.status === 'auto_entrepreneur' && (
          <Text>
            {referrer.first_name} {referrer.last_name}, {status.party_qualifier},
            immatriculé sous le SIRET n° {referrer.siret}, code NAF {referrer.naf_code},
            demeurant {referrer.address}, {referrer.postal_code} {referrer.city}, {referrer.country},
            tél. {referrer.phone}, email {referrer.email}
            {referrer.vat_applicable && referrer.vat_number ? `, n° TVA : ${referrer.vat_number}` : ', en franchise en base de TVA'}.
          </Text>
        )}
        {referrer.status === 'company' && (
          <Text>
            {referrer.company_name}, {referrer.legal_form} au capital de {referrer.capital}€,
            immatriculée au RCS de {referrer.rcs_city} sous le n° {referrer.siret},
            dont le siège social est sis {referrer.address}, {referrer.postal_code} {referrer.city}, {referrer.country},
            représentée par {referrer.legal_representative_name}, en sa qualité de {referrer.legal_representative_role},
            {' '}{status.party_qualifier}
            {referrer.vat_applicable && referrer.vat_number ? `, n° TVA : ${referrer.vat_number}` : ''}.
          </Text>
        )}
      </View>
    </View>
  )
}

function RemunerationSection({ snapshot }: { snapshot: ContractSnapshot }) {
  const rule = snapshot.commission_rule
  const status = getStatusClauses(snapshot.referrer.status)

  let body = ''
  if (rule.type === 'percentage' && rule.percentage != null) {
    body = `La Société versera à l'Apporteur une commission de ${rule.percentage}% calculée sur la base : ${baseLabel(rule.base)}, pour chaque opportunité signalée par l'Apporteur ayant abouti à la signature d'un contrat avec un client final.`
  } else if (rule.type === 'fixed' && rule.fixed_amount != null) {
    body = `La Société versera à l'Apporteur une commission forfaitaire de ${rule.fixed_amount}€ pour chaque opportunité signalée ayant abouti à la signature d'un contrat avec un client final.`
  } else if (rule.type === 'tiered' && rule.tiers) {
    const tierLines = rule.tiers
      .map((t) => `de ${t.from}€ à ${t.to ?? '∞'}€ : ${t.rate}%`)
      .join(' ; ')
    body = `La Société versera à l'Apporteur une commission selon le barème dégressif suivant, calculé sur la base : ${baseLabel(rule.base)} — ${tierLines}.`
  }

  return (
    <View>
      <Text style={styles.h2}>3. Rémunération</Text>
      <Text style={styles.paragraph}>{body}</Text>
      <Text style={styles.paragraph}>
        La commission est due à compter de l'encaissement effectif des sommes par la Société auprès du client final, et sera versée par virement bancaire dans un délai de trente (30) jours suivant cet encaissement.
      </Text>
      <Text style={styles.paragraph}>{status.remuneration_addendum}</Text>
    </View>
  )
}

function baseLabel(base: 'contract_amount' | 'fees' | 'signed_quote' | 'collected_revenue'): string {
  switch (base) {
    case 'contract_amount': return 'le montant total du contrat signé'
    case 'fees': return 'les honoraires perçus par la Société'
    case 'signed_quote': return 'le montant du devis signé'
    case 'collected_revenue': return 'le chiffre d\'affaires effectivement encaissé'
  }
}

export function ContractDocument({ snapshot }: { snapshot: ContractSnapshot }) {
  const industry = getIndustryClauses(snapshot.tenant.industry, snapshot.tenant)
  const status = getStatusClauses(snapshot.referrer.status)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>CONTRAT D'APPORT D'AFFAIRES</Text>
        <Text style={styles.small}>Généré le {new Date(snapshot.generated_at).toLocaleDateString('fr-FR')}</Text>

        <Text style={styles.paragraph}>{COMMON_CLAUSES.preamble(snapshot.tenant.legal_name)}</Text>

        <PartiesSection snapshot={snapshot} />

        <Text style={styles.h2}>2. Objet du Contrat</Text>
        <Text style={styles.paragraph}>{industry.object}</Text>
        <Text style={styles.paragraph}>{industry.legal_mentions}</Text>
        <Text style={styles.paragraph}>{industry.obligations}</Text>

        <RemunerationSection snapshot={snapshot} />

        <Text style={styles.h2}>4. Durée</Text>
        <Text style={styles.paragraph}>{COMMON_CLAUSES.duration(snapshot.contract_duration_months)}</Text>

        <Text style={styles.h2}>5. Confidentialité</Text>
        <Text style={styles.paragraph}>{COMMON_CLAUSES.confidentiality()}</Text>

        <Text style={styles.h2}>6. Exclusivité</Text>
        <Text style={styles.paragraph}>{COMMON_CLAUSES.exclusivity()}</Text>

        <Text style={styles.h2}>7. Données personnelles (RGPD)</Text>
        <Text style={styles.paragraph}>{COMMON_CLAUSES.rgpd(snapshot.tenant.legal_name)}</Text>

        <Text style={styles.h2}>8. Résiliation</Text>
        <Text style={styles.paragraph}>{COMMON_CLAUSES.termination()}</Text>

        <Text style={styles.h2}>9. Loi applicable et juridiction</Text>
        <Text style={styles.paragraph}>{COMMON_CLAUSES.jurisdiction(snapshot.jurisdiction_city)}</Text>

        <View style={styles.signatureRow}>
          <View style={styles.signatureBox}>
            <Text style={styles.partyLabel}>Pour la Société</Text>
            <Text>{snapshot.tenant.representative_name}</Text>
            <Text style={styles.small}>{snapshot.tenant.representative_role}</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.partyLabel}>{status.signature_block_label}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/contracts/template.tsx
git commit -m "feat(contracts): add React-PDF template with industry/status branching"
```

---

### Task 13: PDF generator function (with test)

**Files:**
- Create: `src/lib/contracts/generator.ts`
- Test: `src/lib/contracts/generator.test.ts`

- [ ] **Step 1: Write failing test**

`src/lib/contracts/generator.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { generateContractPDF } from './generator'
import type { ContractSnapshot } from './types'

const baseSnapshot: ContractSnapshot = {
  generated_at: '2026-05-09T12:00:00Z',
  tenant: {
    legal_name: 'Test Real Estate SAS',
    legal_form: 'SAS',
    siret: '12345678900012',
    rcs_city: 'Paris',
    capital: 10000,
    legal_address: '1 rue Test, 75001 Paris',
    representative_name: 'Jean Dupont',
    representative_role: 'Président',
    industry: 'real_estate',
    carte_t_number: 'CPI 1234',
    carte_t_city: 'Paris',
    caisse_garantie: 'CEGC',
  },
  referrer: {
    status: 'individual',
    first_name: 'Marie',
    last_name: 'Martin',
    email: 'marie@example.com',
    birth_date: '1985-03-15',
    birth_place: 'Lyon',
    nationality: 'Française',
    address: '5 avenue Test',
    postal_code: '75002',
    city: 'Paris',
    country: 'France',
    phone: '+33612345678',
    social_security_number_masked: '***********56 78',
    iban_masked: 'FR**** **** **** 0189',
  },
  commission_rule: {
    name: 'Standard',
    type: 'percentage',
    base: 'contract_amount',
    percentage: 5,
  },
  contract_duration_months: 12,
  jurisdiction_city: 'Paris',
}

describe('generateContractPDF', () => {
  it('produces a non-empty PDF buffer', async () => {
    const buf = await generateContractPDF(baseSnapshot)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(1000)
    // PDF magic bytes
    expect(buf.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('produces a PDF for auto_entrepreneur in insurance', async () => {
    const snap: ContractSnapshot = {
      ...baseSnapshot,
      tenant: { ...baseSnapshot.tenant, industry: 'insurance', orias_number: '12345678' },
      referrer: {
        status: 'auto_entrepreneur',
        first_name: 'Paul',
        last_name: 'Bernard',
        email: 'paul@example.com',
        birth_date: '1990-01-01',
        address: '10 rue Test',
        postal_code: '69001',
        city: 'Lyon',
        country: 'France',
        phone: '+33611111111',
        siret: '98765432100012',
        naf_code: '7022Z',
        vat_applicable: false,
        iban_masked: 'FR**** **** **** 0189',
      },
    }
    const buf = await generateContractPDF(snap)
    expect(buf.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('produces a PDF for company in credit', async () => {
    const snap: ContractSnapshot = {
      ...baseSnapshot,
      tenant: { ...baseSnapshot.tenant, industry: 'credit', orias_number: '99999999' },
      referrer: {
        status: 'company',
        email: 'contact@apporteur.fr',
        phone: '+33144444444',
        company_name: 'Apporteur SARL',
        legal_form: 'SARL',
        siret: '11122233300012',
        rcs_city: 'Paris',
        capital: 50000,
        address: '20 rue Test',
        postal_code: '75003',
        city: 'Paris',
        country: 'France',
        vat_applicable: true,
        vat_number: 'FR12345678901',
        legal_representative_name: 'Sophie Durand',
        legal_representative_role: 'Gérante',
        iban_masked: 'FR**** **** **** 0189',
      },
    }
    const buf = await generateContractPDF(snap)
    expect(buf.subarray(0, 4).toString()).toBe('%PDF')
  })
})
```

- [ ] **Step 2: Run test (should fail)**

Run: `npx vitest run src/lib/contracts/generator.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`src/lib/contracts/generator.ts`:
```ts
import { renderToBuffer } from '@react-pdf/renderer'
import { ContractDocument } from './template'
import type { ContractSnapshot } from './types'

export async function generateContractPDF(
  snapshot: ContractSnapshot,
): Promise<Buffer> {
  return renderToBuffer(<ContractDocument snapshot={snapshot} />)
}
```

(Rename to `.tsx` if your build complains about JSX in `.ts`.)

- [ ] **Step 4: Run test**

Run: `npx vitest run src/lib/contracts/generator.test.ts`
Expected: 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/contracts/generator.ts src/lib/contracts/generator.test.ts
git commit -m "feat(contracts): add PDF generator with cross-industry tests"
```

---

## Phase 4 — Yousign Integration

### Task 14: Yousign client (auth + fetch wrapper)

**Files:**
- Create: `src/lib/yousign/types.ts`
- Create: `src/lib/yousign/client.ts`

- [ ] **Step 1: Define types**

`src/lib/yousign/types.ts`:
```ts
export interface YousignSignatureRequest {
  id: string
  status: 'draft' | 'ongoing' | 'done' | 'declined' | 'expired' | 'canceled'
  delivery_mode: 'email' | 'none'
  signers: YousignSigner[]
  documents: YousignDocument[]
}

export interface YousignSigner {
  id: string
  status: 'initiated' | 'notified' | 'signed' | 'declined' | 'expired'
  info: {
    first_name: string
    last_name: string
    email: string
    phone_number?: string
    locale: string
  }
}

export interface YousignDocument {
  id: string
  filename: string
  nature: 'signable_document' | 'attachment'
}

export interface YousignWebhookPayload {
  event_id: string
  event_name: string  // e.g. 'signature_request.done', 'signer.declined'
  event_time: string
  data: {
    signature_request: YousignSignatureRequest
    signer?: YousignSigner
  }
}
```

- [ ] **Step 2: Implement client**

`src/lib/yousign/client.ts`:
```ts
import { serverEnv } from '@/lib/env'

export class YousignError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message)
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  init: { json?: unknown; form?: FormData } = {},
): Promise<T> {
  if (!serverEnv.YOUSIGN_API_KEY) {
    throw new Error('YOUSIGN_API_KEY is not configured')
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${serverEnv.YOUSIGN_API_KEY}`,
  }
  let body: BodyInit | undefined
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(init.json)
  } else if (init.form) {
    body = init.form
  }

  const res = await fetch(`${serverEnv.YOUSIGN_API_BASE}${path}`, { method, headers, body })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    throw new YousignError(res.status, data, `Yousign ${method} ${path} failed: ${res.status}`)
  }
  return data as T
}

export const yousign = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, json: unknown) => request<T>('POST', path, { json }),
  postForm: <T>(path: string, form: FormData) => request<T>('POST', path, { form }),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/yousign/types.ts src/lib/yousign/client.ts
git commit -m "feat(yousign): add API v3 client with bearer auth and error handling"
```

---

### Task 15: Create signature request flow

**Files:**
- Create: `src/lib/yousign/create-request.ts`

- [ ] **Step 1: Implement**

`src/lib/yousign/create-request.ts`:
```ts
import { yousign } from './client'
import type { YousignSignatureRequest, YousignSigner, YousignDocument } from './types'

interface CreateRequestInput {
  name: string                  // contract title shown in emails
  signerEmail: string
  signerFirstName: string
  signerLastName: string
  signerPhone?: string
  pdfBuffer: Buffer
  pdfFilename: string
  expirationDays?: number       // default 30
}

export interface CreatedRequest {
  signatureRequestId: string
  documentId: string
  signerId: string
}

/**
 * Creates a Yousign signature request, uploads the PDF, adds the signer
 * with a signature field on the last page, and activates the request
 * (which triggers the email to the signer).
 */
export async function createSignatureRequest(
  input: CreateRequestInput,
): Promise<CreatedRequest> {
  // 1. Create the signature request
  const sr = await yousign.post<YousignSignatureRequest>('/signature_requests', {
    name: input.name,
    delivery_mode: 'email',
    timezone: 'Europe/Paris',
    expiration_date: new Date(
      Date.now() + (input.expirationDays ?? 30) * 86400 * 1000,
    ).toISOString().slice(0, 10),
  })

  // 2. Upload the PDF
  const form = new FormData()
  form.append('file', new Blob([input.pdfBuffer], { type: 'application/pdf' }), input.pdfFilename)
  form.append('nature', 'signable_document')
  const doc = await yousign.postForm<YousignDocument>(
    `/signature_requests/${sr.id}/documents`,
    form,
  )

  // 3. Add signer with a signature field on the last page
  const signer = await yousign.post<YousignSigner>(
    `/signature_requests/${sr.id}/signers`,
    {
      info: {
        first_name: input.signerFirstName,
        last_name: input.signerLastName,
        email: input.signerEmail,
        phone_number: input.signerPhone,
        locale: 'fr',
      },
      signature_level: 'electronic_signature',  // Standard
      signature_authentication_mode: 'no_otp',
      fields: [
        {
          type: 'signature',
          document_id: doc.id,
          page: -1,                 // last page
          x: 350,
          y: 600,
          width: 200,
          height: 80,
        },
      ],
    },
  )

  // 4. Activate (sends email)
  await yousign.post(`/signature_requests/${sr.id}/activate`, {})

  return {
    signatureRequestId: sr.id,
    documentId: doc.id,
    signerId: signer.id,
  }
}

/**
 * Downloads the signed PDF as a Buffer.
 */
export async function downloadSignedPdf(
  signatureRequestId: string,
  documentId: string,
): Promise<Buffer> {
  const url = `${process.env.YOUSIGN_API_BASE}/signature_requests/${signatureRequestId}/documents/${documentId}/download`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.YOUSIGN_API_KEY}` },
  })
  if (!res.ok) throw new Error(`Failed to download signed PDF: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/yousign/create-request.ts
git commit -m "feat(yousign): add signature request creation flow"
```

---

### Task 16: Webhook HMAC verification (TDD)

**Files:**
- Create: `src/lib/yousign/webhook.ts`
- Test: `src/lib/yousign/webhook.test.ts`

- [ ] **Step 1: Write failing test**

`src/lib/yousign/webhook.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createHmac } from 'crypto'
import { verifyYousignSignature } from './webhook'

const SECRET = 'test-webhook-secret-32bytes-aaaaa'

beforeAll(() => {
  process.env.YOUSIGN_WEBHOOK_SECRET = SECRET
})

function sign(body: string): string {
  return createHmac('sha256', SECRET).update(body).digest('hex')
}

describe('verifyYousignSignature', () => {
  it('accepts a valid signature', () => {
    const body = '{"event_id":"abc"}'
    expect(verifyYousignSignature(body, sign(body))).toBe(true)
  })

  it('rejects an invalid signature', () => {
    expect(verifyYousignSignature('{"a":1}', 'deadbeef'.repeat(8))).toBe(false)
  })

  it('rejects an empty signature', () => {
    expect(verifyYousignSignature('{}', '')).toBe(false)
  })

  it('throws if secret env var is missing', () => {
    delete process.env.YOUSIGN_WEBHOOK_SECRET
    expect(() => verifyYousignSignature('{}', 'x')).toThrow(/YOUSIGN_WEBHOOK_SECRET/)
    process.env.YOUSIGN_WEBHOOK_SECRET = SECRET
  })
})
```

- [ ] **Step 2: Run test (should fail)**

Run: `npx vitest run src/lib/yousign/webhook.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`src/lib/yousign/webhook.ts`:
```ts
import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Verifies a Yousign webhook signature.
 * Yousign signs the raw request body with HMAC-SHA256 using the webhook secret.
 * The signature is sent in the `X-Yousign-Signature-256` header (hex).
 */
export function verifyYousignSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.YOUSIGN_WEBHOOK_SECRET
  if (!secret) throw new Error('YOUSIGN_WEBHOOK_SECRET env var is required')
  if (!signature) return false

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  if (expected.length !== signature.length) return false

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run test**

Run: `npx vitest run src/lib/yousign/webhook.test.ts`
Expected: 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/yousign/webhook.ts src/lib/yousign/webhook.test.ts
git commit -m "feat(yousign): add HMAC-SHA256 webhook signature verification"
```

---

## Phase 5 — Server Actions and API Routes

### Task 17: Service role Supabase client helper

**Files:**
- Modify: `src/lib/supabase/server.ts`

- [ ] **Step 1: Read current file**

Open `src/lib/supabase/server.ts` to inspect the existing client setup.

- [ ] **Step 2: Add a service role variant**

Append to `src/lib/supabase/server.ts`:
```ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Service role client — bypasses RLS. Use ONLY in trusted server contexts
 * (webhooks, cron jobs, admin background ops). Never expose to the client.
 */
export function createServiceRoleClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/server.ts
git commit -m "feat: add service role Supabase client for trusted server ops"
```

---

### Task 18: API route — POST /api/contracts/send

**Files:**
- Create: `src/app/api/contracts/send/route.ts`

- [ ] **Step 1: Implement**

`src/app/api/contracts/send/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { generateContractPDF } from '@/lib/contracts/generator'
import { decrypt } from '@/lib/contracts/encryption'
import { maskIban, maskSSN } from '@/lib/contracts/snapshot'
import { createSignatureRequest } from '@/lib/yousign/create-request'
import type { ContractSnapshot } from '@/lib/contracts/types'
import { isContractSignatureEnabled } from '@/lib/env'

const BodySchema = z.object({ memberId: z.string().uuid() })

export async function POST(req: Request) {
  if (!isContractSignatureEnabled()) {
    return NextResponse.json({ error: 'feature_disabled' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // 1. Load member + tenant + profile + commission rule
  const { data: member, error: mErr } = await supabase
    .from('tenant_members')
    .select(`
      id, tenant_id, user_id, role,
      profile:profiles!tenant_members_user_id_fkey (*),
      tenant:tenants (*)
    `)
    .eq('id', parsed.data.memberId)
    .single()
  if (mErr || !member) return NextResponse.json({ error: 'member_not_found' }, { status: 404 })

  // 2. Authorization: only admins of the tenant
  const { data: callerMember } = await supabase
    .from('tenant_members')
    .select('role, tenant_id')
    .eq('user_id', user.id)
    .eq('tenant_id', member.tenant_id)
    .single()
  if (!callerMember || callerMember.role !== 'company_admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // 3. Load default commission rule
  const { data: rule } = await supabase
    .from('commission_rules')
    .select('*')
    .eq('tenant_id', member.tenant_id)
    .eq('is_default', true)
    .single()
  if (!rule) return NextResponse.json({ error: 'no_commission_rule' }, { status: 422 })

  // 4. Validate referrer info is complete
  const profile = member.profile as any
  const tenant = member.tenant as any
  if (!profile.referrer_status) {
    return NextResponse.json({ error: 'referrer_info_missing' }, { status: 422 })
  }

  // 5. Build snapshot
  const ibanPlain = profile.iban_encrypted
    ? decrypt(Buffer.from(profile.iban_encrypted, 'base64'))
    : ''
  const ssnPlain = profile.social_security_number_encrypted
    ? decrypt(Buffer.from(profile.social_security_number_encrypted, 'base64'))
    : ''

  const snapshot: ContractSnapshot = buildSnapshot(profile, tenant, rule, ibanPlain, ssnPlain)

  // 6. Generate PDF
  const pdfBuffer = await generateContractPDF(snapshot)

  // 7. Insert contract row (status=draft)
  const admin = createServiceRoleClient()
  const { data: contract, error: cErr } = await admin
    .from('contracts')
    .insert({
      tenant_id: member.tenant_id,
      member_id: member.id,
      status: 'draft',
      contract_data: snapshot,
    })
    .select('*')
    .single()
  if (cErr || !contract) {
    return NextResponse.json({ error: 'contract_insert_failed', detail: cErr?.message }, { status: 500 })
  }

  // 8. Upload unsigned PDF
  const unsignedPath = `${member.tenant_id}/${contract.id}.pdf`
  await admin.storage
    .from('contracts-unsigned')
    .upload(unsignedPath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  // 9. Create Yousign request
  const [firstName, ...rest] = (profile.full_name ?? profile.email).split(' ')
  const lastName = rest.join(' ') || ''
  const created = await createSignatureRequest({
    name: `Contrat d'apporteur — ${tenant.legal_name ?? tenant.name}`,
    signerEmail: profile.email,
    signerFirstName: firstName,
    signerLastName: lastName,
    signerPhone: profile.phone ?? undefined,
    pdfBuffer,
    pdfFilename: `contrat-apporteur.pdf`,
  })

  // 10. Update contract row to "sent"
  await admin
    .from('contracts')
    .update({
      status: 'sent',
      yousign_signature_request_id: created.signatureRequestId,
      yousign_document_id: created.documentId,
      unsigned_pdf_path: unsignedPath,
      sent_at: new Date().toISOString(),
    })
    .eq('id', contract.id)

  return NextResponse.json({ contractId: contract.id, status: 'sent' })
}

function buildSnapshot(
  profile: any,
  tenant: any,
  rule: any,
  ibanPlain: string,
  ssnPlain: string,
): ContractSnapshot {
  const tenantSnap = {
    legal_name: tenant.legal_name ?? tenant.name,
    legal_form: tenant.legal_form ?? '',
    siret: tenant.siret ?? '',
    rcs_city: tenant.rcs_city ?? '',
    capital: Number(tenant.capital ?? 0),
    legal_address: tenant.legal_address ?? '',
    representative_name: tenant.representative_name ?? '',
    representative_role: tenant.representative_role ?? 'Représentant légal',
    industry: tenant.industry,
    carte_t_number: tenant.carte_t_number,
    carte_t_city: tenant.carte_t_city,
    caisse_garantie: tenant.caisse_garantie,
    orias_number: tenant.orias_number,
  }

  const common = {
    email: profile.email,
    phone: profile.phone ?? '',
    address: profile.address ?? '',
    postal_code: profile.postal_code ?? '',
    city: profile.city ?? '',
    country: profile.country ?? 'France',
    iban_masked: maskIban(ibanPlain),
  }

  let referrer
  if (profile.referrer_status === 'individual') {
    const [first, ...last] = (profile.full_name ?? '').split(' ')
    referrer = {
      status: 'individual' as const,
      first_name: first ?? '',
      last_name: last.join(' '),
      birth_date: profile.birth_date,
      birth_place: profile.birth_place ?? '',
      nationality: profile.nationality ?? 'Française',
      social_security_number_masked: maskSSN(ssnPlain),
      ...common,
    }
  } else if (profile.referrer_status === 'auto_entrepreneur') {
    const [first, ...last] = (profile.full_name ?? '').split(' ')
    referrer = {
      status: 'auto_entrepreneur' as const,
      first_name: first ?? '',
      last_name: last.join(' '),
      birth_date: profile.birth_date,
      siret: profile.siret,
      naf_code: profile.naf_code ?? '',
      vat_applicable: !!profile.vat_applicable,
      vat_number: profile.vat_number ?? undefined,
      ...common,
    }
  } else {
    referrer = {
      status: 'company' as const,
      company_name: profile.company_name,
      legal_form: profile.legal_form,
      siret: profile.siret,
      rcs_city: profile.rcs_city ?? '',
      capital: Number(profile.capital ?? 0),
      vat_applicable: !!profile.vat_applicable,
      vat_number: profile.vat_number ?? undefined,
      legal_representative_name: profile.legal_representative_name,
      legal_representative_role: profile.legal_representative_role,
      ...common,
    }
  }

  return {
    generated_at: new Date().toISOString(),
    tenant: tenantSnap,
    referrer,
    commission_rule: {
      name: rule.name,
      type: rule.type,
      base: rule.base,
      percentage: rule.percentage ?? undefined,
      fixed_amount: rule.fixed_amount ?? undefined,
    },
    contract_duration_months: 12,
    jurisdiction_city: tenantSnap.rcs_city || tenantSnap.legal_address || 'Paris',
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS (may need to adjust profile/tenant column names to match actual DB)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/contracts/send/route.ts
git commit -m "feat(api): add POST /api/contracts/send to generate and send contract"
```

---

### Task 19: API route — POST /api/webhooks/yousign

**Files:**
- Create: `src/app/api/webhooks/yousign/route.ts`

- [ ] **Step 1: Implement**

`src/app/api/webhooks/yousign/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { verifyYousignSignature } from '@/lib/yousign/webhook'
import { downloadSignedPdf } from '@/lib/yousign/create-request'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { YousignWebhookPayload } from '@/lib/yousign/types'

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-yousign-signature-256') ?? ''

  if (!verifyYousignSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  let payload: YousignWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const admin = createServiceRoleClient()

  // Idempotency: dedupe by event_id
  const { error: dupErr } = await admin
    .from('yousign_events')
    .insert({
      yousign_event_id: payload.event_id,
      event_type: payload.event_name,
      signature_request_id: payload.data.signature_request?.id ?? null,
      payload,
    })
  if (dupErr) {
    // unique violation = already processed
    if ((dupErr as any).code === '23505') return NextResponse.json({ ok: true, dedup: true })
    return NextResponse.json({ error: 'event_log_failed' }, { status: 500 })
  }

  const sr = payload.data.signature_request
  if (!sr) return NextResponse.json({ ok: true })

  // Find the matching contract
  const { data: contract } = await admin
    .from('contracts')
    .select('*')
    .eq('yousign_signature_request_id', sr.id)
    .single()
  if (!contract) {
    // Could be racing with /send insert — log and return 200 to avoid retry storms
    console.warn(`Webhook: no contract for SR ${sr.id}`)
    return NextResponse.json({ ok: true, warning: 'contract_not_found' })
  }

  switch (payload.event_name) {
    case 'signature_request.done': {
      const pdf = await downloadSignedPdf(sr.id, contract.yousign_document_id!)
      const signedPath = `${contract.tenant_id}/${contract.id}.pdf`
      await admin.storage.from('contracts-signed').upload(signedPath, pdf, {
        contentType: 'application/pdf',
        upsert: true,
      })
      await admin
        .from('contracts')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
          signed_pdf_path: signedPath,
        })
        .eq('id', contract.id)
      break
    }
    case 'signer.declined':
    case 'signature_request.declined': {
      await admin
        .from('contracts')
        .update({ status: 'declined' })
        .eq('id', contract.id)
      break
    }
    case 'signature_request.expired': {
      await admin
        .from('contracts')
        .update({ status: 'expired', expires_at: new Date().toISOString() })
        .eq('id', contract.id)
      break
    }
    default:
      // Other events (signer.notified, signer.signed, etc.) — no-op
      break
  }

  await admin
    .from('yousign_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('yousign_event_id', payload.event_id)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/yousign/route.ts
git commit -m "feat(api): add Yousign webhook handler with idempotent event log"
```

---

## Phase 6 — UI

### Task 20: Onboarding referrer — status selection step

**Files:**
- Create: `src/app/onboarding/referrer/page.tsx`
- Create: `src/app/onboarding/referrer/referrer-onboarding-form.tsx`
- Create: `src/app/onboarding/referrer/actions.ts`

- [ ] **Step 1: Page (server component)**

`src/app/onboarding/referrer/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ReferrerOnboardingForm } from './referrer-onboarding-form'

export default async function ReferrerOnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="container max-w-2xl py-10">
      <h1 className="text-2xl font-semibold mb-2">Complétez votre profil</h1>
      <p className="text-muted-foreground mb-8">
        Ces informations sont nécessaires pour générer votre contrat d'apporteur.
      </p>
      <ReferrerOnboardingForm initial={profile ?? null} />
    </div>
  )
}
```

- [ ] **Step 2: Server action**

`src/app/onboarding/referrer/actions.ts`:
```ts
'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/contracts/encryption'
import { redirect } from 'next/navigation'

const baseSchema = z.object({
  address: z.string().min(3),
  postal_code: z.string().min(3),
  city: z.string().min(1),
  country: z.string().default('France'),
  phone: z.string().min(8),
  iban: z.string().min(15),
  bic: z.string().min(8).optional(),
})

const individualSchema = baseSchema.extend({
  referrer_status: z.literal('individual'),
  birth_date: z.string(),
  birth_place: z.string().min(1),
  nationality: z.string().default('Française'),
  social_security_number: z.string().min(13),
})

const aeSchema = baseSchema.extend({
  referrer_status: z.literal('auto_entrepreneur'),
  birth_date: z.string(),
  siret: z.string().length(14),
  naf_code: z.string().min(4),
  vat_applicable: z.boolean().default(false),
  vat_number: z.string().optional(),
})

const companySchema = baseSchema.extend({
  referrer_status: z.literal('company'),
  company_name: z.string().min(1),
  legal_form: z.string().min(2),
  siret: z.string().length(14),
  rcs_city: z.string().min(1),
  capital: z.coerce.number().min(0),
  vat_applicable: z.boolean().default(false),
  vat_number: z.string().optional(),
  legal_representative_name: z.string().min(1),
  legal_representative_role: z.string().min(1),
})

const ReferrerSchema = z.discriminatedUnion('referrer_status', [
  individualSchema, aeSchema, companySchema,
])

export async function saveReferrerInfo(input: unknown) {
  const data = ReferrerSchema.parse(input)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('unauthorized')

  const update: any = {
    referrer_status: data.referrer_status,
    address: data.address,
    postal_code: data.postal_code,
    city: data.city,
    country: data.country,
    phone: data.phone,
    iban_encrypted: encrypt(data.iban),
    bic: data.bic ?? null,
  }

  if (data.referrer_status === 'individual') {
    Object.assign(update, {
      birth_date: data.birth_date,
      birth_place: data.birth_place,
      nationality: data.nationality,
      social_security_number_encrypted: encrypt(data.social_security_number),
    })
  } else if (data.referrer_status === 'auto_entrepreneur') {
    Object.assign(update, {
      birth_date: data.birth_date,
      siret: data.siret,
      naf_code: data.naf_code,
      vat_applicable: data.vat_applicable,
      vat_number: data.vat_number ?? null,
    })
  } else {
    Object.assign(update, {
      company_name: data.company_name,
      legal_form: data.legal_form,
      siret: data.siret,
      rcs_city: data.rcs_city,
      capital: data.capital,
      vat_applicable: data.vat_applicable,
      vat_number: data.vat_number ?? null,
      legal_representative_name: data.legal_representative_name,
      legal_representative_role: data.legal_representative_role,
    })
  }

  await supabase.from('profiles').update(update).eq('id', user.id)

  // Find the member's tenant and trigger contract send
  const { data: member } = await supabase
    .from('tenant_members')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .eq('role', 'referrer')
    .single()
  if (!member) throw new Error('no_membership')

  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/contracts/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberId: member.id }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'send_failed')

  redirect(`/sign/${json.contractId}`)
}
```

- [ ] **Step 3: Client form**

`src/app/onboarding/referrer/referrer-onboarding-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { saveReferrerInfo } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Status = 'individual' | 'auto_entrepreneur' | 'company'

export function ReferrerOnboardingForm({ initial }: { initial: any }) {
  const [status, setStatus] = useState<Status | null>(initial?.referrer_status ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!status) {
    return (
      <Card>
        <CardHeader><CardTitle>Quel est votre statut ?</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start h-auto py-4" onClick={() => setStatus('individual')}>
            <div className="text-left">
              <div className="font-semibold">Particulier (apport occasionnel)</div>
              <div className="text-sm text-muted-foreground">Jusqu'à 3 opérations par année civile.</div>
            </div>
          </Button>
          <Button variant="outline" className="w-full justify-start h-auto py-4" onClick={() => setStatus('auto_entrepreneur')}>
            <div className="text-left">
              <div className="font-semibold">Auto-entrepreneur</div>
              <div className="text-sm text-muted-foreground">Vous facturez via votre micro-entreprise (SIRET).</div>
            </div>
          </Button>
          <Button variant="outline" className="w-full justify-start h-auto py-4" onClick={() => setStatus('company')}>
            <div className="text-left">
              <div className="font-semibold">Société (SAS, SARL, etc.)</div>
              <div className="text-sm text-muted-foreground">Personne morale avec représentant légal.</div>
            </div>
          </Button>
        </CardContent>
      </Card>
    )
  }

  async function onSubmit(formData: FormData) {
    setSubmitting(true)
    setError(null)
    try {
      const data = Object.fromEntries(formData.entries())
      ;(data as any).referrer_status = status
      ;(data as any).vat_applicable = data.vat_applicable === 'on'
      await saveReferrerInfo(data)
    } catch (e: any) {
      setError(e?.message ?? 'Erreur')
      setSubmitting(false)
    }
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Vos informations</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {status === 'individual' && <IndividualFields />}
          {status === 'auto_entrepreneur' && <AutoEntrepreneurFields />}
          {status === 'company' && <CompanyFields />}
          <Field label="Adresse" name="address" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Code postal" name="postal_code" />
            <Field label="Ville" name="city" />
          </div>
          <Field label="Téléphone" name="phone" type="tel" />
          <Field label="IBAN" name="iban" />
          <Field label="BIC" name="bic" required={false} />
        </CardContent>
      </Card>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-between">
        <Button type="button" variant="ghost" onClick={() => setStatus(null)}>Retour</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Génération du contrat...' : 'Générer mon contrat'}
        </Button>
      </div>
    </form>
  )
}

function Field({ label, name, type = 'text', required = true }: any) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} />
    </div>
  )
}

function IndividualFields() {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Date de naissance" name="birth_date" type="date" />
        <Field label="Lieu de naissance" name="birth_place" />
      </div>
      <Field label="Nationalité" name="nationality" />
      <Field label="N° de sécurité sociale" name="social_security_number" />
    </>
  )
}

function AutoEntrepreneurFields() {
  return (
    <>
      <Field label="Date de naissance" name="birth_date" type="date" />
      <div className="grid grid-cols-2 gap-4">
        <Field label="SIRET" name="siret" />
        <Field label="Code NAF/APE" name="naf_code" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="vat_applicable" /> Assujetti à la TVA
      </label>
      <Field label="N° TVA intracom" name="vat_number" required={false} />
    </>
  )
}

function CompanyFields() {
  return (
    <>
      <Field label="Raison sociale" name="company_name" />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Forme juridique" name="legal_form" />
        <Field label="Capital social (€)" name="capital" type="number" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="SIRET" name="siret" />
        <Field label="Ville RCS" name="rcs_city" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="vat_applicable" /> Assujetti à la TVA
      </label>
      <Field label="N° TVA intracom" name="vat_number" required={false} />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nom du représentant légal" name="legal_representative_name" />
        <Field label="Qualité (Président, Gérant...)" name="legal_representative_role" />
      </div>
    </>
  )
}
```

- [ ] **Step 4: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/onboarding/referrer/
git commit -m "feat(ui): add referrer onboarding flow with status-specific form"
```

---

### Task 21: Sign page

**Files:**
- Create: `src/app/(app)/sign/[contractId]/page.tsx`

- [ ] **Step 1: Implement**

`src/app/(app)/sign/[contractId]/page.tsx`:
```tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default async function SignPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single()

  if (!contract) notFound()

  if (contract.status === 'signed') {
    return (
      <div className="container max-w-xl py-10">
        <Card>
          <CardHeader><CardTitle>Contrat signé ✅</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-4">Votre contrat a été signé le {new Date(contract.signed_at!).toLocaleDateString('fr-FR')}.</p>
            <Button asChild><a href="/dashboard">Accéder au dashboard</a></Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-xl py-10">
      <Card>
        <CardHeader><CardTitle>Signature de votre contrat</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p>Un email vient de vous être envoyé par Yousign avec le lien de signature.</p>
          <p className="text-sm text-muted-foreground">
            Vérifiez votre boîte de réception (et vos spams). Une fois la signature effectuée,
            cette page se mettra à jour automatiquement et vous aurez accès au dashboard.
          </p>
          <p className="text-sm">Statut actuel : <strong>{statusLabel(contract.status)}</strong></p>
        </CardContent>
      </Card>
    </div>
  )
}

function statusLabel(s: string) {
  return {
    draft: 'Brouillon',
    pending_info: 'En attente de vos informations',
    sent: 'Envoyé — en attente de signature',
    signed: 'Signé',
    declined: 'Refusé',
    expired: 'Expiré',
    canceled: 'Annulé',
  }[s] ?? s
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/sign/
git commit -m "feat(ui): add /sign/[contractId] referrer signature page"
```

---

### Task 22: Modify invite acceptance to redirect into onboarding

**Files:**
- Modify: `src/app/invite/[token]/accept-form.tsx`

- [ ] **Step 1: Read current file**

Open `src/app/invite/[token]/accept-form.tsx` to find the post-accept redirect.

- [ ] **Step 2: Replace the post-accept redirect**

Wherever the form currently calls `router.push('/dashboard')` (or similar), gate it on the feature flag and the role:
```ts
import { isContractSignatureEnabled } from '@/lib/env'
// ...
// After successful tenant_member creation:
if (isContractSignatureEnabled() && newMember.role === 'referrer') {
  router.push('/onboarding/referrer')
} else {
  router.push('/dashboard')
}
```

If `isContractSignatureEnabled` is server-only, replace with a `NEXT_PUBLIC_*` mirror or pass the flag down from the server component.

For simplicity, expose a public flag:

In `.env.example` add:
```
NEXT_PUBLIC_ENABLE_CONTRACT_SIGNATURE=false
```

In the form:
```ts
const SIG_ENABLED = process.env.NEXT_PUBLIC_ENABLE_CONTRACT_SIGNATURE === 'true'
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/invite/\[token\]/accept-form.tsx .env.example
git commit -m "feat(invite): redirect referrers to onboarding when signature flag enabled"
```

---

### Task 23: Middleware contract guard

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Read current file**

Open `src/middleware.ts` to inspect the current matcher and logic.

- [ ] **Step 2: Add contract guard**

Update `src/middleware.ts`:
```ts
import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'

const SIG_ENABLED = process.env.ENABLE_CONTRACT_SIGNATURE === 'true'

const ALLOW_PATHS = [
  '/login', '/signup', '/forgot-password', '/reset-password',
  '/auth/callback', '/api/webhooks/yousign', '/onboarding',
  '/sign', '/invite', '/p/', '/_next', '/favicon',
]

export async function middleware(req: NextRequest) {
  const res = await updateSession(req)
  if (!SIG_ENABLED) return res

  const { pathname } = req.nextUrl
  if (ALLOW_PATHS.some((p) => pathname.startsWith(p))) return res

  // Guard only the (app) routes
  if (!pathname.startsWith('/dashboard') && !pathname.startsWith('/referral') &&
      !pathname.startsWith('/opportunities') && !pathname.startsWith('/commissions') &&
      !pathname.startsWith('/account')) {
    return res
  }

  // Build a server client for this request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {},
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res

  // Find a referrer membership without signed contract
  const { data: members } = await supabase
    .from('tenant_members')
    .select('id, role, tenant_id, profile:profiles!tenant_members_user_id_fkey(referrer_status)')
    .eq('user_id', user.id)

  const referrerMember = members?.find((m: any) => m.role === 'referrer')
  if (!referrerMember) return res

  // No referrer info yet → onboarding
  if (!(referrerMember as any).profile?.referrer_status) {
    const url = req.nextUrl.clone()
    url.pathname = '/onboarding/referrer'
    return NextResponse.redirect(url)
  }

  // Has info but no active signed contract → /sign
  const { data: contract } = await supabase
    .from('contracts')
    .select('id, status')
    .eq('member_id', referrerMember.id)
    .in('status', ['draft', 'pending_info', 'sent', 'signed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (contract && contract.status === 'signed') return res

  if (contract) {
    const url = req.nextUrl.clone()
    url.pathname = `/sign/${contract.id}`
    return NextResponse.redirect(url)
  }

  // No contract yet → onboarding will trigger send
  const url = req.nextUrl.clone()
  url.pathname = '/onboarding/referrer'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(middleware): guard referrer routes behind signed contract"
```

---

### Task 24: Admin team member view (contract status)

**Files:**
- Create: `src/app/(app)/team/[memberId]/page.tsx`

- [ ] **Step 1: Implement**

`src/app/(app)/team/[memberId]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MarkSignedOfflineButton } from './mark-signed-offline'

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

  const profile = member.profile as any

  return (
    <div className="container py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{profile?.full_name ?? profile?.email}</h1>
        <p className="text-muted-foreground">{profile?.email}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Contrat d'apporteur</CardTitle></CardHeader>
        <CardContent>
          {contracts && contracts.length > 0 ? (
            <ul className="space-y-3">
              {contracts.map((c) => (
                <li key={c.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <Badge>{c.status}</Badge>
                    <span className="ml-3 text-sm text-muted-foreground">
                      {c.signed_at ? `Signé le ${new Date(c.signed_at).toLocaleDateString('fr-FR')}` :
                       c.sent_at ? `Envoyé le ${new Date(c.sent_at).toLocaleDateString('fr-FR')}` : 'Brouillon'}
                    </span>
                  </div>
                  {c.signed_pdf_path && (
                    <a className="text-sm underline" href={`/api/contracts/${c.id}/download`}>Télécharger PDF</a>
                  )}
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
```

- [ ] **Step 2: Mark-signed-offline button (client + action)**

`src/app/(app)/team/[memberId]/mark-signed-offline.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { markSignedOffline } from './actions'

export function MarkSignedOfflineButton({ memberId }: { memberId: string }) {
  const [busy, setBusy] = useState(false)

  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        if (!confirm('Marquer ce contrat comme signé hors-ligne ? Cette action est tracée.')) return
        setBusy(true)
        try { await markSignedOffline(memberId) }
        finally { setBusy(false) }
      }}
    >
      Marquer comme signé hors-ligne
    </Button>
  )
}
```

`src/app/(app)/team/[memberId]/actions.ts`:
```ts
'use server'

import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markSignedOffline(memberId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('unauthorized')

  // Verify caller is admin of the same tenant
  const { data: member } = await supabase
    .from('tenant_members').select('tenant_id').eq('id', memberId).single()
  if (!member) throw new Error('member_not_found')

  const { data: caller } = await supabase
    .from('tenant_members').select('role').eq('user_id', user.id).eq('tenant_id', member.tenant_id).single()
  if (caller?.role !== 'company_admin') throw new Error('forbidden')

  const admin = createServiceRoleClient()
  await admin.from('contracts').insert({
    tenant_id: member.tenant_id,
    member_id: memberId,
    status: 'signed',
    signed_at: new Date().toISOString(),
    contract_data: { offline: true, marked_by: user.id },
  })

  revalidatePath(`/team/${memberId}`)
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/team/\[memberId\]/
git commit -m "feat(ui): add admin team member detail page with contract status"
```

---

## Phase 7 — Manual Sandbox Testing

### Task 25: End-to-end sandbox test checklist

**Files:** none (manual verification)

- [ ] **Step 1: Configure sandbox env**

In `.env.local`:
```
ENABLE_CONTRACT_SIGNATURE=true
NEXT_PUBLIC_ENABLE_CONTRACT_SIGNATURE=true
YOUSIGN_API_KEY=<your_sandbox_key>
YOUSIGN_API_BASE=https://api-sandbox.yousign.app/v3
YOUSIGN_WEBHOOK_SECRET=<generate_random>
ENCRYPTION_KEY=<openssl rand -base64 32>
```

- [ ] **Step 2: Configure Yousign webhook**

In Yousign sandbox dashboard:
- URL: `https://lead-partner-one.vercel.app/api/webhooks/yousign` (or use ngrok for local)
- Secret: same as `YOUSIGN_WEBHOOK_SECRET`
- Events: subscribe to `signature_request.done`, `signature_request.declined`, `signature_request.expired`

- [ ] **Step 3: Set tenant legal info**

In Supabase SQL Editor, fill in your test tenant's legal fields:
```sql
update public.tenants
set legal_name = 'Test Real Estate SAS',
    legal_form = 'SAS',
    siret = '12345678900012',
    rcs_city = 'Paris',
    capital = 10000,
    legal_address = '1 rue Test, 75001 Paris',
    representative_name = 'Jean Dupont',
    representative_role = 'Président',
    carte_t_number = 'CPI 1234'
where slug = 'your-tenant-slug';
```

- [ ] **Step 4: Test individual flow**

1. Create a new test apporteur invite (`/team/invite`)
2. Accept the invite with a fresh email account
3. Verify redirect to `/onboarding/referrer`
4. Choose "Particulier", fill the form
5. Verify redirect to `/sign/<id>`
6. Check email for Yousign invite, click link, sign
7. Verify webhook fires, contract status updates to `signed`
8. Verify dashboard becomes accessible
9. Verify signed PDF in `contracts-signed` bucket

- [ ] **Step 5: Test auto-entrepreneur flow**

Repeat with a second test account, choosing "Auto-entrepreneur".

- [ ] **Step 6: Test company flow**

Repeat with a third test account, choosing "Société".

- [ ] **Step 7: Test decline flow**

Repeat with a fourth account, but on the Yousign signature page, click "Refuser". Verify status updates to `declined`.

- [ ] **Step 8: Test admin override**

As admin, on `/team/<memberId>`, click "Marquer comme signé hors-ligne". Verify a new `signed` contract row is created and dashboard unlocks.

- [ ] **Step 9: Document results**

Create a quick `docs/superpowers/test-results-2026-05-09.md` summarizing what passed and any issues found.

- [ ] **Step 10: Commit**

```bash
git add docs/superpowers/test-results-2026-05-09.md
git commit -m "docs: add Yousign sandbox e2e test results"
```

---

## Self-Review Checklist (already performed during plan writing)

- ✅ Spec coverage: every section of the spec maps to at least one task above (data model → Tasks 3-6, encryption → 7, PDF → 8-13, Yousign → 14-16, API → 17-19, UI → 20-24, testing → 25)
- ✅ No placeholders: all code blocks contain real implementation; no "TBD"
- ✅ Type consistency: `ContractSnapshot`, `ReferrerStatus`, `IndustryCode` used consistently across tasks
- ✅ TDD applied to: encryption (Task 7), snapshot helpers (Task 8), generator (Task 13), webhook HMAC (Task 16). UI and config tasks are not TDD-driven (low value).

## Notes for the Implementer

- **Branching**: do this work on a feature branch like `feat/yousign-signature`. Don't merge to `main` until Task 25 passes.
- **Migration order**: apply `0004` → `0005` → `0006` in that exact order. Don't run them in parallel.
- **Webhook URL during local dev**: use ngrok or Cloudflare Tunnel to expose localhost to Yousign sandbox.
- **Testing framework**: this plan introduces Vitest for the first time. If the project later wants Playwright for e2e, that's a separate effort.
- **Known assumption**: `profiles.full_name` exists. If your schema uses `first_name` / `last_name`, adjust the snapshot builder in Task 18 accordingly.
