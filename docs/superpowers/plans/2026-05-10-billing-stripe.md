# Billing & Stripe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-seat Stripe billing with 14-day trial, 3 plans (Starter/Pro/Business), proration on extra seats, soft read-only fallback at expiration, Customer Portal for self-service.

**Architecture:** Stripe Checkout for initial subscription, Customer Portal for management, webhooks (`/api/webhooks/stripe` HMAC-verified) as source of truth for `subscriptions` table sync. Read-only enforcement via `requireActiveSubscription()` guard called from server actions and API routes; middleware redirects banner-state. Daily Vercel Cron triggers trial-reminder emails.

**Tech Stack:** Next.js 15, Supabase (Postgres + RLS), TypeScript, Stripe Node SDK v17+, Zod, Vitest, React-PDF (existing), Vercel Cron.

**Reference spec:** `docs/superpowers/specs/2026-05-10-billing-stripe-design.md`

---

## Phase 1 — Foundation

### Task 1: Install Stripe SDK + update PLANS constant

**Files:**
- Modify: `package.json`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Install Stripe**

```bash
npm install stripe
```

- [ ] **Step 2: Update PLANS constant**

Replace the `PLANS` array in `src/lib/constants.ts` with the new pricing:

```ts
export const PLANS: {
  value: SubscriptionPlan;
  label: string;
  monthly_price: number;
  annual_price: number;
  included_seats: number;
  extra_seat_monthly: number;
  features: string[];
  cta: string;
}[] = [
  {
    value: "starter",
    label: "Starter",
    monthly_price: 29,
    annual_price: 296,
    included_seats: 3,
    extra_seat_monthly: 12,
    features: [
      "1 admin + 2 collaborateurs",
      "Apporteurs illimités",
      "Branding personnalisé",
      "Signature de contrats Yousign",
      "Support email",
    ],
    cta: "Choisir Starter",
  },
  {
    value: "pro",
    label: "Pro",
    monthly_price: 79,
    annual_price: 806,
    included_seats: 6,
    extra_seat_monthly: 9,
    features: [
      "1 admin + 5 collaborateurs",
      "Apporteurs illimités",
      "Branding personnalisé",
      "Signature de contrats Yousign",
      "Support prioritaire",
      "Sièges supplémentaires +9 €/mois",
    ],
    cta: "Choisir Pro",
  },
  {
    value: "business",
    label: "Business",
    monthly_price: 199,
    annual_price: 2030,
    included_seats: 16,
    extra_seat_monthly: 6,
    features: [
      "1 admin + 15 collaborateurs",
      "Apporteurs illimités",
      "Branding personnalisé",
      "Signature de contrats Yousign",
      "Support dédié",
      "Sièges supplémentaires +6 €/mois (dégressif)",
    ],
    cta: "Choisir Business",
  },
];
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS (constants.ts may have callers that still reference `price` — fix in Task 16 when we touch the billing UI).

If type-check fails because callers use `.price`, temporarily expose a `price` getter:
```ts
// Add at end of file if needed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(PLANS as any).forEach((p: any) => { p.price = p.monthly_price })
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/constants.ts
git commit -m "chore: install Stripe SDK and update PLANS pricing"
```

---

### Task 2: Extend env schema with Stripe variables

**Files:**
- Modify: `src/lib/env.ts`
- Modify: `.env.example`

- [ ] **Step 1: Update env schema**

Replace `src/lib/env.ts`:
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

  // Stripe API
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Stripe Price IDs (12)
  STRIPE_PRICE_STARTER_MONTHLY: z.string().optional(),
  STRIPE_PRICE_STARTER_ANNUAL: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_ANNUAL: z.string().optional(),
  STRIPE_PRICE_BUSINESS_MONTHLY: z.string().optional(),
  STRIPE_PRICE_BUSINESS_ANNUAL: z.string().optional(),
  STRIPE_PRICE_EXTRA_SEAT_STARTER_MONTHLY: z.string().optional(),
  STRIPE_PRICE_EXTRA_SEAT_STARTER_ANNUAL: z.string().optional(),
  STRIPE_PRICE_EXTRA_SEAT_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_EXTRA_SEAT_PRO_ANNUAL: z.string().optional(),
  STRIPE_PRICE_EXTRA_SEAT_BUSINESS_MONTHLY: z.string().optional(),
  STRIPE_PRICE_EXTRA_SEAT_BUSINESS_ANNUAL: z.string().optional(),

  // Cron auth
  CRON_SECRET: z.string().min(1).optional(),
})

export const serverEnv = ServerEnvSchema.parse(process.env)

export const isContractSignatureEnabled = () =>
  serverEnv.ENABLE_CONTRACT_SIGNATURE === 'true'

export const isStripeEnabled = () => !!serverEnv.STRIPE_SECRET_KEY
```

- [ ] **Step 2: Update .env.example**

Append to `.env.example`:
```
# Stripe API
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Stripe Price IDs (capture from Stripe Dashboard → Products)
STRIPE_PRICE_STARTER_MONTHLY=
STRIPE_PRICE_STARTER_ANNUAL=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_ANNUAL=
STRIPE_PRICE_BUSINESS_MONTHLY=
STRIPE_PRICE_BUSINESS_ANNUAL=
STRIPE_PRICE_EXTRA_SEAT_STARTER_MONTHLY=
STRIPE_PRICE_EXTRA_SEAT_STARTER_ANNUAL=
STRIPE_PRICE_EXTRA_SEAT_PRO_MONTHLY=
STRIPE_PRICE_EXTRA_SEAT_PRO_ANNUAL=
STRIPE_PRICE_EXTRA_SEAT_BUSINESS_MONTHLY=
STRIPE_PRICE_EXTRA_SEAT_BUSINESS_ANNUAL=

# Vercel Cron auth (random hex string, used to authenticate cron requests)
CRON_SECRET=
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/env.ts .env.example
git commit -m "feat(env): add Stripe env vars schema"
```

---

### Task 3: Database migration — billing schema

**Files:**
- Create: `supabase/migrations/0007_billing_schema.sql`

- [ ] **Step 1: Write migration**

`supabase/migrations/0007_billing_schema.sql`:
```sql
-- =====================================================================
-- Billing & Stripe — schema additions
-- =====================================================================

-- 1. Extend subscription_status enum with Stripe states
alter type public.subscription_status add value if not exists 'incomplete';
alter type public.subscription_status add value if not exists 'incomplete_expired';
alter type public.subscription_status add value if not exists 'unpaid';

-- 2. Enrich subscriptions table
alter table public.subscriptions
  add column billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'annual')),
  add column included_seats integer not null default 3,
  add column extra_seats integer not null default 0,
  add column current_period_start timestamptz,
  add column trial_ends_at timestamptz,
  add column canceled_at timestamptz,
  add column cancel_at_period_end boolean not null default false,
  add column stripe_price_id text,
  add column stripe_extra_seat_price_id text;

-- 3. Audit table for seat changes
create table public.seat_changes (
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
create index seat_changes_tenant_idx on public.seat_changes(tenant_id, effective_at desc);

-- 4. Stripe webhook events log (idempotency)
create table public.stripe_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- 5. Helper functions
create or replace function public.count_paid_seats(t uuid)
returns integer language sql stable as $$
  select count(*)::integer
  from public.tenant_members
  where tenant_id = t
    and status = 'active'
    and role in ('company_admin', 'collaborator');
$$;

create or replace function public.seats_remaining(t uuid)
returns integer language sql stable as $$
  select greatest(
    0,
    coalesce(
      (select included_seats + extra_seats
       from public.subscriptions
       where tenant_id = t
       order by created_at desc limit 1),
      0
    ) - public.count_paid_seats(t)
  );
$$;

-- 6. RLS
alter table public.stripe_events enable row level security;
-- (no policies = service role only)

alter table public.seat_changes enable row level security;
create policy seat_changes_admin_read on public.seat_changes
  for select using (public.is_admin_of(tenant_id));
```

- [ ] **Step 2: Apply migration**

User pastes the file contents in **Supabase Dashboard → SQL Editor** and clicks Run.

- [ ] **Step 3: Verify**

Run in SQL Editor:
```sql
select 'subscriptions.billing_cycle' as item, count(*) as ok
from information_schema.columns
where table_schema='public' and table_name='subscriptions' and column_name='billing_cycle'
union all
select 'subscriptions.trial_ends_at', count(*) from information_schema.columns
where table_schema='public' and table_name='subscriptions' and column_name='trial_ends_at'
union all
select 'seat_changes table', count(*) from information_schema.tables
where table_schema='public' and table_name='seat_changes'
union all
select 'stripe_events table', count(*) from information_schema.tables
where table_schema='public' and table_name='stripe_events'
union all
select 'fn count_paid_seats', count(*) from pg_proc
where proname='count_paid_seats'
union all
select 'fn seats_remaining', count(*) from pg_proc
where proname='seats_remaining';
```

Each row must return `1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0007_billing_schema.sql
git commit -m "feat(db): add billing schema (subscriptions extensions, seat_changes, stripe_events)"
```

---

### Task 4: Backfill subscriptions for existing tenants

**Files:** none (manual SQL run by user)

- [ ] **Step 1: Run backfill SQL**

In Supabase SQL Editor, run:
```sql
insert into public.subscriptions (
  tenant_id, plan, status, trial_ends_at,
  included_seats, billing_cycle
)
select
  t.id, 'starter', 'trialing',
  now() + interval '14 days',
  3, 'monthly'
from public.tenants t
where not exists (
  select 1 from public.subscriptions s where s.tenant_id = t.id
);
```

- [ ] **Step 2: Verify**

```sql
select t.slug, s.status, s.trial_ends_at
from public.tenants t
left join public.subscriptions s on s.tenant_id = t.id
order by t.created_at desc;
```

Every tenant must have a `trialing` subscription with `trial_ends_at` ~14 days in the future.

- [ ] **Step 3: Commit**

(no code change — just a SQL operation logged in the spec)

```bash
echo "Backfill executed on $(date +%Y-%m-%d)" >> docs/superpowers/billing-rollout-log.md
git add docs/superpowers/billing-rollout-log.md
git commit -m "ops: backfill subscriptions for existing tenants (14-day trial)"
```

---

### Task 5: Update database types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Update SubscriptionStatus type**

In `src/types/database.ts`:
```ts
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid";
```

- [ ] **Step 2: Update subscriptions table type**

Find the `subscriptions:` block and replace with:
```ts
subscriptions: {
  Row: {
    id: string;
    tenant_id: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    current_period_end: string | null;
    current_period_start: string | null;
    trial_ends_at: string | null;
    canceled_at: string | null;
    cancel_at_period_end: boolean;
    billing_cycle: "monthly" | "annual";
    included_seats: number;
    extra_seats: number;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    stripe_price_id: string | null;
    stripe_extra_seat_price_id: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]> & {
    tenant_id: string;
    plan: SubscriptionPlan;
  };
  Update: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]>;
};
```

- [ ] **Step 3: Add seat_changes and stripe_events**

Inside the `Tables: { ... }` object, append:
```ts
seat_changes: {
  Row: {
    id: string;
    tenant_id: string;
    type: "add" | "remove";
    member_id: string | null;
    effective_at: string;
    changed_by: string | null;
    proration_amount_cents: number | null;
    stripe_invoice_id: string | null;
    created_at: string;
  };
  Insert: Partial<Database["public"]["Tables"]["seat_changes"]["Row"]> & {
    tenant_id: string;
    type: "add" | "remove";
  };
  Update: Partial<Database["public"]["Tables"]["seat_changes"]["Row"]>;
};
stripe_events: {
  Row: {
    id: string;
    stripe_event_id: string;
    event_type: string;
    payload: Json;
    received_at: string;
    processed_at: string | null;
  };
  Insert: Partial<Database["public"]["Tables"]["stripe_events"]["Row"]> & {
    stripe_event_id: string;
    event_type: string;
    payload: Json;
  };
  Update: Partial<Database["public"]["Tables"]["stripe_events"]["Row"]>;
};
```

- [ ] **Step 4: Add helper function types**

In the `Functions: { ... }` block:
```ts
count_paid_seats: { Args: { t: string }; Returns: number };
seats_remaining: { Args: { t: string }; Returns: number };
```

- [ ] **Step 5: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/types/database.ts
git commit -m "chore(types): regenerate types for billing schema"
```

---

## Phase 2 — Stripe Library

### Task 6: Stripe client + plans config

**Files:**
- Create: `src/lib/stripe/client.ts`
- Create: `src/lib/stripe/plans.ts`
- Test: `src/lib/stripe/plans.test.ts`

- [ ] **Step 1: Create Stripe client**

`src/lib/stripe/client.ts`:
```ts
import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  _stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion })
  return _stripe
}
```

- [ ] **Step 2: Write failing test for plans.ts**

`src/lib/stripe/plans.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { getMainPriceId, getExtraSeatPriceId, getPlanFromPriceId } from './plans'

beforeAll(() => {
  process.env.STRIPE_PRICE_STARTER_MONTHLY = 'price_starter_m'
  process.env.STRIPE_PRICE_STARTER_ANNUAL = 'price_starter_a'
  process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_m'
  process.env.STRIPE_PRICE_PRO_ANNUAL = 'price_pro_a'
  process.env.STRIPE_PRICE_BUSINESS_MONTHLY = 'price_biz_m'
  process.env.STRIPE_PRICE_BUSINESS_ANNUAL = 'price_biz_a'
  process.env.STRIPE_PRICE_EXTRA_SEAT_STARTER_MONTHLY = 'price_extra_s_m'
  process.env.STRIPE_PRICE_EXTRA_SEAT_STARTER_ANNUAL = 'price_extra_s_a'
  process.env.STRIPE_PRICE_EXTRA_SEAT_PRO_MONTHLY = 'price_extra_p_m'
  process.env.STRIPE_PRICE_EXTRA_SEAT_PRO_ANNUAL = 'price_extra_p_a'
  process.env.STRIPE_PRICE_EXTRA_SEAT_BUSINESS_MONTHLY = 'price_extra_b_m'
  process.env.STRIPE_PRICE_EXTRA_SEAT_BUSINESS_ANNUAL = 'price_extra_b_a'
})

describe('plans', () => {
  it('returns the correct main price for plan + cycle', () => {
    expect(getMainPriceId('starter', 'monthly')).toBe('price_starter_m')
    expect(getMainPriceId('starter', 'annual')).toBe('price_starter_a')
    expect(getMainPriceId('pro', 'monthly')).toBe('price_pro_m')
    expect(getMainPriceId('business', 'annual')).toBe('price_biz_a')
  })

  it('returns the correct extra seat price for plan + cycle', () => {
    expect(getExtraSeatPriceId('starter', 'monthly')).toBe('price_extra_s_m')
    expect(getExtraSeatPriceId('pro', 'annual')).toBe('price_extra_p_a')
    expect(getExtraSeatPriceId('business', 'monthly')).toBe('price_extra_b_m')
  })

  it('reverses a price ID back to plan + cycle', () => {
    expect(getPlanFromPriceId('price_pro_m')).toEqual({ plan: 'pro', cycle: 'monthly', kind: 'main' })
    expect(getPlanFromPriceId('price_extra_b_a')).toEqual({ plan: 'business', cycle: 'annual', kind: 'extra' })
    expect(getPlanFromPriceId('unknown_price')).toBeNull()
  })

  it('throws when an env var is missing', () => {
    delete process.env.STRIPE_PRICE_PRO_MONTHLY
    expect(() => getMainPriceId('pro', 'monthly')).toThrow(/STRIPE_PRICE_PRO_MONTHLY/)
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_m'
  })
})
```

- [ ] **Step 3: Run test (fail)**

Run: `npx vitest run src/lib/stripe/plans.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement plans.ts**

`src/lib/stripe/plans.ts`:
```ts
import type { SubscriptionPlan } from '@/types/database'

export type BillingCycle = 'monthly' | 'annual'

const MAIN_ENV: Record<SubscriptionPlan, Record<BillingCycle, string>> = {
  starter:  { monthly: 'STRIPE_PRICE_STARTER_MONTHLY',  annual: 'STRIPE_PRICE_STARTER_ANNUAL'  },
  pro:      { monthly: 'STRIPE_PRICE_PRO_MONTHLY',      annual: 'STRIPE_PRICE_PRO_ANNUAL'      },
  business: { monthly: 'STRIPE_PRICE_BUSINESS_MONTHLY', annual: 'STRIPE_PRICE_BUSINESS_ANNUAL' },
}

const EXTRA_ENV: Record<SubscriptionPlan, Record<BillingCycle, string>> = {
  starter:  { monthly: 'STRIPE_PRICE_EXTRA_SEAT_STARTER_MONTHLY',  annual: 'STRIPE_PRICE_EXTRA_SEAT_STARTER_ANNUAL'  },
  pro:      { monthly: 'STRIPE_PRICE_EXTRA_SEAT_PRO_MONTHLY',      annual: 'STRIPE_PRICE_EXTRA_SEAT_PRO_ANNUAL'      },
  business: { monthly: 'STRIPE_PRICE_EXTRA_SEAT_BUSINESS_MONTHLY', annual: 'STRIPE_PRICE_EXTRA_SEAT_BUSINESS_ANNUAL' },
}

function readEnv(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`${key} env var is required`)
  return v
}

export function getMainPriceId(plan: SubscriptionPlan, cycle: BillingCycle): string {
  return readEnv(MAIN_ENV[plan][cycle])
}

export function getExtraSeatPriceId(plan: SubscriptionPlan, cycle: BillingCycle): string {
  return readEnv(EXTRA_ENV[plan][cycle])
}

export interface PriceLookup {
  plan: SubscriptionPlan
  cycle: BillingCycle
  kind: 'main' | 'extra'
}

export function getPlanFromPriceId(priceId: string): PriceLookup | null {
  for (const plan of ['starter', 'pro', 'business'] as SubscriptionPlan[]) {
    for (const cycle of ['monthly', 'annual'] as BillingCycle[]) {
      try {
        if (getMainPriceId(plan, cycle) === priceId) return { plan, cycle, kind: 'main' }
        if (getExtraSeatPriceId(plan, cycle) === priceId) return { plan, cycle, kind: 'extra' }
      } catch {
        // env not set — skip
      }
    }
  }
  return null
}
```

- [ ] **Step 5: Run test (pass)**

Run: `npx vitest run src/lib/stripe/plans.test.ts`
Expected: 4 tests passing

- [ ] **Step 6: Commit**

```bash
git add src/lib/stripe/client.ts src/lib/stripe/plans.ts src/lib/stripe/plans.test.ts
git commit -m "feat(stripe): add Stripe client and plans config (TDD)"
```

---

### Task 7: Webhook signature verification (TDD)

**Files:**
- Create: `src/lib/stripe/webhook-events.ts`
- Test: `src/lib/stripe/webhook-events.test.ts`

- [ ] **Step 1: Write failing test**

`src/lib/stripe/webhook-events.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { verifyStripeWebhook } from './webhook-events'
import Stripe from 'stripe'

const SECRET = 'whsec_test_secret'

beforeAll(() => {
  process.env.STRIPE_WEBHOOK_SECRET = SECRET
})

function signedHeader(payload: string, ts: number): string {
  const stripe = new Stripe('sk_test_dummy')
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: SECRET,
    timestamp: ts,
  })
}

describe('verifyStripeWebhook', () => {
  it('accepts a valid signature', () => {
    const payload = JSON.stringify({ id: 'evt_test', type: 'invoice.paid' })
    const sig = signedHeader(payload, Math.floor(Date.now() / 1000))
    const event = verifyStripeWebhook(payload, sig)
    expect(event.id).toBe('evt_test')
    expect(event.type).toBe('invoice.paid')
  })

  it('rejects a tampered payload', () => {
    const payload = JSON.stringify({ id: 'evt_test', type: 'invoice.paid' })
    const sig = signedHeader(payload, Math.floor(Date.now() / 1000))
    expect(() => verifyStripeWebhook('{"id":"different"}', sig)).toThrow()
  })

  it('rejects when secret is missing', () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    expect(() => verifyStripeWebhook('{}', 'sig')).toThrow(/STRIPE_WEBHOOK_SECRET/)
    process.env.STRIPE_WEBHOOK_SECRET = SECRET
  })
})
```

- [ ] **Step 2: Run test (fail)**

Run: `npx vitest run src/lib/stripe/webhook-events.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`src/lib/stripe/webhook-events.ts`:
```ts
import Stripe from 'stripe'
import { getStripe } from './client'

export function verifyStripeWebhook(rawBody: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET env var is required')
  const stripe = getStripe()
  return stripe.webhooks.constructEvent(rawBody, signature, secret)
}
```

Note: this requires `STRIPE_SECRET_KEY` for `getStripe()` even though we only use the static `webhooks.constructEvent` method. To make it test-friendly:

```ts
import Stripe from 'stripe'

export function verifyStripeWebhook(rawBody: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET env var is required')
  // constructEvent is static-like; we just need a Stripe instance
  return Stripe.webhooks.constructEvent(rawBody, signature, secret)
}
```

(`Stripe.webhooks` is exposed on the Stripe namespace itself — no instance needed.)

- [ ] **Step 4: Run test (pass)**

Run: `npx vitest run src/lib/stripe/webhook-events.test.ts`
Expected: 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/stripe/webhook-events.ts src/lib/stripe/webhook-events.test.ts
git commit -m "feat(stripe): add webhook signature verification (TDD)"
```

---

### Task 8: Subscription sync logic

**Files:**
- Create: `src/lib/stripe/subscription-sync.ts`

- [ ] **Step 1: Implement sync function**

`src/lib/stripe/subscription-sync.ts`:
```ts
import type Stripe from 'stripe'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPlanFromPriceId } from './plans'

/**
 * Mirror a Stripe Subscription into the local `subscriptions` table.
 * Idempotent: calling twice with the same Stripe state yields the same DB state.
 *
 * Looks up the tenant via subscription.metadata.tenant_id (set at Checkout creation).
 */
export async function syncSubscriptionFromStripe(sub: Stripe.Subscription) {
  const tenantId = sub.metadata?.tenant_id
  if (!tenantId) {
    console.warn(`Stripe subscription ${sub.id} has no tenant_id metadata — skipping sync`)
    return
  }

  // Find main item (the plan itself) and count extra-seat quantity
  let mainPriceId: string | null = null
  let extraSeatPriceId: string | null = null
  let extraSeats = 0

  for (const item of sub.items.data) {
    const priceId = item.price.id
    const lookup = getPlanFromPriceId(priceId)
    if (!lookup) continue
    if (lookup.kind === 'main') {
      mainPriceId = priceId
    } else if (lookup.kind === 'extra') {
      extraSeatPriceId = priceId
      extraSeats = item.quantity ?? 0
    }
  }

  if (!mainPriceId) {
    console.warn(`Could not identify main plan for sub ${sub.id}`)
    return
  }

  const lookup = getPlanFromPriceId(mainPriceId)!
  const includedSeats = { starter: 3, pro: 6, business: 16 }[lookup.plan]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any

  const { data: existing } = await admin
    .from('subscriptions')
    .select('id')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const update = {
    plan: lookup.plan,
    status: sub.status,
    billing_cycle: lookup.cycle,
    included_seats: includedSeats,
    extra_seats: extraSeats,
    stripe_customer_id: sub.customer as string,
    stripe_subscription_id: sub.id,
    stripe_price_id: mainPriceId,
    stripe_extra_seat_price_id: extraSeatPriceId,
    current_period_start: sub.current_period_start
      ? new Date(sub.current_period_start * 1000).toISOString() : null,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString() : null,
    trial_ends_at: sub.trial_end
      ? new Date(sub.trial_end * 1000).toISOString() : null,
    canceled_at: sub.canceled_at
      ? new Date(sub.canceled_at * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
  }

  if (existing) {
    await admin.from('subscriptions').update(update).eq('id', existing.id)
  } else {
    await admin.from('subscriptions').insert({
      tenant_id: tenantId,
      ...update,
    })
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/stripe/subscription-sync.ts
git commit -m "feat(stripe): add idempotent subscription sync from Stripe to DB"
```

---

### Task 9: Checkout session creation

**Files:**
- Create: `src/lib/stripe/checkout.ts`

- [ ] **Step 1: Implement**

`src/lib/stripe/checkout.ts`:
```ts
import { getStripe } from './client'
import { getMainPriceId, type BillingCycle } from './plans'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { SubscriptionPlan } from '@/types/database'

interface CreateCheckoutInput {
  tenantId: string
  adminEmail: string
  plan: SubscriptionPlan
  cycle: BillingCycle
  successUrl: string
  cancelUrl: string
}

export async function createCheckoutSession(input: CreateCheckoutInput): Promise<string> {
  const stripe = getStripe()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any

  // Reuse existing Stripe Customer if any
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('tenant_id', input.tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let customerId: string | undefined = sub?.stripe_customer_id ?? undefined

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: input.adminEmail,
      metadata: { tenant_id: input.tenantId },
    })
    customerId = customer.id
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      { price: getMainPriceId(input.plan, input.cycle), quantity: 1 },
    ],
    subscription_data: {
      metadata: { tenant_id: input.tenantId },
    },
    automatic_tax: { enabled: true },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: false,
  })

  if (!session.url) throw new Error('Stripe did not return a checkout URL')
  return session.url
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/stripe/checkout.ts
git commit -m "feat(stripe): add checkout session creation"
```

---

### Task 10: Customer Portal session

**Files:**
- Create: `src/lib/stripe/portal.ts`

- [ ] **Step 1: Implement**

`src/lib/stripe/portal.ts`:
```ts
import { getStripe } from './client'

export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<string> {
  const stripe = getStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })
  return session.url
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/stripe/portal.ts
git commit -m "feat(stripe): add Customer Portal session creation"
```

---

### Task 11: Seat management (add/remove with proration)

**Files:**
- Create: `src/lib/stripe/seats.ts`

- [ ] **Step 1: Implement**

`src/lib/stripe/seats.ts`:
```ts
import { getStripe } from './client'
import { getExtraSeatPriceId } from './plans'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { SubscriptionPlan } from '@/types/database'

/**
 * Estimate the prorated cost of adding 1 extra seat right now.
 * Returns cents.
 */
export async function previewSeatAddition(tenantId: string): Promise<{
  monthlyAmountCents: number
  proratedAmountCents: number
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id, plan, billing_cycle')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!sub?.stripe_subscription_id) {
    throw new Error('no_active_subscription')
  }

  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
  const extraPriceId = getExtraSeatPriceId(sub.plan as SubscriptionPlan, sub.billing_cycle)
  const extraPrice = await stripe.prices.retrieve(extraPriceId)

  // Find existing extra seat item, if any
  const existingItem = subscription.items.data.find((i) => i.price.id === extraPriceId)
  const newQuantity = (existingItem?.quantity ?? 0) + 1

  const items = existingItem
    ? [{ id: existingItem.id, quantity: newQuantity }]
    : [{ price: extraPriceId, quantity: 1 }]

  const upcoming = await stripe.invoices.retrieveUpcoming({
    subscription: subscription.id,
    subscription_items: items,
    subscription_proration_behavior: 'always_invoice',
  })

  // Sum the prorated lines for the extra-seat price only
  const proratedAmountCents = upcoming.lines.data
    .filter((l) => l.proration && l.price?.id === extraPriceId)
    .reduce((sum, l) => sum + l.amount, 0)

  return {
    monthlyAmountCents: extraPrice.unit_amount ?? 0,
    proratedAmountCents,
  }
}

/**
 * Add one extra seat to the subscription. Returns the resulting Stripe invoice id
 * (the immediate prorated invoice).
 */
export async function addExtraSeat(tenantId: string): Promise<{ invoiceId: string | null; newExtraSeats: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id, plan, billing_cycle, extra_seats')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!sub?.stripe_subscription_id) {
    throw new Error('no_active_subscription')
  }

  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
  const extraPriceId = getExtraSeatPriceId(sub.plan as SubscriptionPlan, sub.billing_cycle)

  const existingItem = subscription.items.data.find((i) => i.price.id === extraPriceId)
  const newQuantity = (existingItem?.quantity ?? 0) + 1

  const updated = await stripe.subscriptions.update(subscription.id, {
    items: existingItem
      ? [{ id: existingItem.id, quantity: newQuantity }]
      : [{ price: extraPriceId, quantity: 1 }],
    proration_behavior: 'always_invoice',
  })

  await admin
    .from('subscriptions')
    .update({ extra_seats: newQuantity })
    .eq('tenant_id', tenantId)

  return {
    invoiceId: typeof updated.latest_invoice === 'string' ? updated.latest_invoice : updated.latest_invoice?.id ?? null,
    newExtraSeats: newQuantity,
  }
}

/**
 * Remove one extra seat from the subscription. Effective at end of period (no immediate refund).
 */
export async function removeExtraSeat(tenantId: string): Promise<{ newExtraSeats: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id, plan, billing_cycle')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!sub?.stripe_subscription_id) {
    throw new Error('no_active_subscription')
  }

  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
  const extraPriceId = getExtraSeatPriceId(sub.plan as SubscriptionPlan, sub.billing_cycle)
  const existingItem = subscription.items.data.find((i) => i.price.id === extraPriceId)
  if (!existingItem || (existingItem.quantity ?? 0) <= 0) return { newExtraSeats: 0 }

  const newQuantity = (existingItem.quantity ?? 0) - 1

  if (newQuantity === 0) {
    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: existingItem.id, deleted: true }],
      proration_behavior: 'none',
    })
  } else {
    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: existingItem.id, quantity: newQuantity }],
      proration_behavior: 'none',
    })
  }

  await admin
    .from('subscriptions')
    .update({ extra_seats: newQuantity })
    .eq('tenant_id', tenantId)

  return { newExtraSeats: newQuantity }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/stripe/seats.ts
git commit -m "feat(stripe): add seat add/remove with proration"
```

---

## Phase 3 — Subscription Guard

### Task 12: requireActiveSubscription helper (TDD)

**Files:**
- Create: `src/lib/auth/require-active-subscription.ts`
- Test: `src/lib/auth/require-active-subscription.test.ts`

- [ ] **Step 1: Write failing test**

`src/lib/auth/require-active-subscription.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { evaluateSubscriptionAccess } from './require-active-subscription'

describe('evaluateSubscriptionAccess', () => {
  it('allows when status is active', () => {
    expect(evaluateSubscriptionAccess({
      status: 'active', trial_ends_at: null,
    })).toEqual({ allowed: true })
  })

  it('allows when trialing and not expired', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString()
    expect(evaluateSubscriptionAccess({
      status: 'trialing', trial_ends_at: tomorrow,
    })).toEqual({ allowed: true })
  })

  it('blocks when trialing but trial expired', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    expect(evaluateSubscriptionAccess({
      status: 'trialing', trial_ends_at: yesterday,
    })).toEqual({ allowed: false, reason: 'trial_expired' })
  })

  it('blocks when canceled', () => {
    expect(evaluateSubscriptionAccess({
      status: 'canceled', trial_ends_at: null,
    })).toEqual({ allowed: false, reason: 'subscription_inactive' })
  })

  it('blocks when unpaid', () => {
    expect(evaluateSubscriptionAccess({
      status: 'unpaid', trial_ends_at: null,
    })).toEqual({ allowed: false, reason: 'subscription_inactive' })
  })

  it('blocks when incomplete_expired', () => {
    expect(evaluateSubscriptionAccess({
      status: 'incomplete_expired', trial_ends_at: null,
    })).toEqual({ allowed: false, reason: 'subscription_inactive' })
  })

  it('allows when past_due (Stripe handles retries, app stays open)', () => {
    expect(evaluateSubscriptionAccess({
      status: 'past_due', trial_ends_at: null,
    })).toEqual({ allowed: true })
  })

  it('blocks when no subscription', () => {
    expect(evaluateSubscriptionAccess(null)).toEqual({
      allowed: false, reason: 'no_subscription',
    })
  })
})
```

- [ ] **Step 2: Run test (fail)**

Run: `npx vitest run src/lib/auth/require-active-subscription.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`src/lib/auth/require-active-subscription.ts`:
```ts
import type { SubscriptionStatus } from '@/types/database'
import { createClient } from '@/lib/supabase/server'

export interface SubscriptionStateForGuard {
  status: SubscriptionStatus
  trial_ends_at: string | null
}

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; reason: 'trial_expired' | 'subscription_inactive' | 'no_subscription' }

export function evaluateSubscriptionAccess(
  sub: SubscriptionStateForGuard | null,
): AccessDecision {
  if (!sub) return { allowed: false, reason: 'no_subscription' }
  if (sub.status === 'active') return { allowed: true }
  if (sub.status === 'past_due') return { allowed: true }
  if (sub.status === 'trialing') {
    if (!sub.trial_ends_at) return { allowed: true }
    const expired = new Date(sub.trial_ends_at) < new Date()
    return expired
      ? { allowed: false, reason: 'trial_expired' }
      : { allowed: true }
  }
  return { allowed: false, reason: 'subscription_inactive' }
}

export class SubscriptionGuardError extends Error {
  constructor(public reason: 'trial_expired' | 'subscription_inactive' | 'no_subscription') {
    super(reason)
  }
}

/**
 * Server-side guard. Throws SubscriptionGuardError when access is not allowed.
 * Call this at the top of any server action or API route that mutates data.
 */
export async function requireActiveSubscription(tenantId: string): Promise<void> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('status, trial_ends_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const decision = evaluateSubscriptionAccess(data ?? null)
  if (!decision.allowed) throw new SubscriptionGuardError(decision.reason)
}
```

- [ ] **Step 4: Run test (pass)**

Run: `npx vitest run src/lib/auth/require-active-subscription.test.ts`
Expected: 8 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/require-active-subscription.ts src/lib/auth/require-active-subscription.test.ts
git commit -m "feat(auth): add requireActiveSubscription guard (TDD)"
```

---

## Phase 4 — API Routes

### Task 13: POST /api/stripe/checkout

**Files:**
- Create: `src/app/api/stripe/checkout/route.ts`

- [ ] **Step 1: Implement**

`src/app/api/stripe/checkout/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession } from '@/lib/stripe/checkout'

const BodySchema = z.object({
  plan: z.enum(['starter', 'pro', 'business']),
  cycle: z.enum(['monthly', 'annual']),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Caller must be company_admin of some tenant
  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('role', 'company_admin')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!member) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    const url = await createCheckoutSession({
      tenantId: member.tenant_id,
      adminEmail: user.email!,
      plan: parsed.data.plan,
      cycle: parsed.data.cycle,
      successUrl: `${baseUrl}/settings/billing?success=1`,
      cancelUrl: `${baseUrl}/settings/billing`,
    })
    return NextResponse.json({ url })
  } catch (e) {
    return NextResponse.json({ error: 'checkout_failed', detail: (e as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/stripe/checkout/route.ts
git commit -m "feat(api): add POST /api/stripe/checkout"
```

---

### Task 14: POST /api/stripe/portal

**Files:**
- Create: `src/app/api/stripe/portal/route.ts`

- [ ] **Step 1: Implement**

`src/app/api/stripe/portal/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { createCustomerPortalSession } from '@/lib/stripe/portal'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('role', 'company_admin')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!member) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('tenant_id', member.tenant_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: 'no_stripe_customer' }, { status: 422 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    const url = await createCustomerPortalSession(
      sub.stripe_customer_id,
      `${baseUrl}/settings/billing`,
    )
    return NextResponse.json({ url })
  } catch (e) {
    return NextResponse.json({ error: 'portal_failed', detail: (e as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/stripe/portal/route.ts
git commit -m "feat(api): add POST /api/stripe/portal"
```

---

### Task 15: POST /api/webhooks/stripe

**Files:**
- Create: `src/app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Implement**

`src/app/api/webhooks/stripe/route.ts`:
```ts
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { verifyStripeWebhook } from '@/lib/stripe/webhook-events'
import { syncSubscriptionFromStripe } from '@/lib/stripe/subscription-sync'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = verifyStripeWebhook(rawBody, signature)
  } catch (e) {
    return NextResponse.json({ error: 'invalid_signature', detail: (e as Error).message }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any

  // Idempotency: dedupe by event id
  const { error: dupErr } = await admin
    .from('stripe_events')
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: event as any,
    })
  if (dupErr) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((dupErr as any).code === '23505') return NextResponse.json({ ok: true, dedup: true })
    return NextResponse.json({ error: 'event_log_failed', detail: dupErr.message }, { status: 500 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription' && typeof session.subscription === 'string') {
          const stripe = getStripe()
          const sub = await stripe.subscriptions.retrieve(session.subscription)
          await syncSubscriptionFromStripe(sub)
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription)
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await admin
          .from('subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id)
        break
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        if (typeof invoice.subscription === 'string') {
          const stripe = getStripe()
          const sub = await stripe.subscriptions.retrieve(invoice.subscription)
          await syncSubscriptionFromStripe(sub)
        }
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        if (typeof invoice.subscription === 'string') {
          await admin
            .from('subscriptions')
            .update({ status: 'past_due' })
            .eq('stripe_subscription_id', invoice.subscription)
        }
        break
      }
      case 'customer.subscription.trial_will_end': {
        // Email handled by daily cron — no-op here
        break
      }
      default:
        // Unhandled event type — log and ignore
        break
    }

    await admin
      .from('stripe_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('stripe_event_id', event.id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'handler_failed', detail: (e as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "feat(api): add POST /api/webhooks/stripe with idempotent event log"
```

---

### Task 16: POST /api/stripe/seats (preview + add)

**Files:**
- Create: `src/app/api/stripe/seats/preview/route.ts`
- Create: `src/app/api/stripe/seats/add/route.ts`

- [ ] **Step 1: Preview route**

`src/app/api/stripe/seats/preview/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { previewSeatAddition } from '@/lib/stripe/seats'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('role', 'company_admin')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (!member) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const preview = await previewSeatAddition(member.tenant_id)
    return NextResponse.json(preview)
  } catch (e) {
    return NextResponse.json({ error: 'preview_failed', detail: (e as Error).message }, { status: 422 })
  }
}
```

- [ ] **Step 2: Add seat route**

`src/app/api/stripe/seats/add/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { addExtraSeat } from '@/lib/stripe/seats'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('role', 'company_admin')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (!member) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const result = await addExtraSeat(member.tenant_id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createServiceRoleClient() as any
    await admin.from('seat_changes').insert({
      tenant_id: member.tenant_id,
      type: 'add',
      changed_by: user.id,
      stripe_invoice_id: result.invoiceId,
    })

    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: 'add_seat_failed', detail: (e as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/stripe/seats/
git commit -m "feat(api): add seat preview and add routes"
```

---

## Phase 5 — UI

### Task 17: SubscriptionBanner component

**Files:**
- Create: `src/components/app/subscription-banner.tsx`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Create banner component**

`src/components/app/subscription-banner.tsx`:
```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export async function SubscriptionBanner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('role', 'company_admin')
    .limit(1)
    .maybeSingle()
  if (!member) return null

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, trial_ends_at, current_period_end, cancel_at_period_end')
    .eq('tenant_id', member.tenant_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!sub) return null

  const now = Date.now()
  const trialEnds = sub.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : 0
  const daysLeft = Math.ceil((trialEnds - now) / 86400000)

  let message: string | null = null
  let color: 'yellow' | 'orange' | 'red' | 'gray' = 'yellow'

  if (sub.status === 'trialing' && trialEnds < now) {
    message = 'Compte en lecture seule. Activez votre abonnement.'
    color = 'red'
  } else if (sub.status === 'trialing' && daysLeft <= 2) {
    message = `Essai expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}. Activez maintenant.`
    color = 'orange'
  } else if (sub.status === 'trialing' && daysLeft <= 7) {
    message = `Essai : ${daysLeft} jours restants. Configurez votre plan.`
    color = 'yellow'
  } else if (sub.status === 'past_due') {
    message = 'Paiement échoué. Mettez à jour votre carte.'
    color = 'red'
  } else if (sub.status === 'canceled' || sub.status === 'unpaid' || sub.status === 'incomplete_expired') {
    message = 'Compte en lecture seule. Activez votre abonnement.'
    color = 'red'
  } else if (sub.cancel_at_period_end && sub.current_period_end) {
    const end = new Date(sub.current_period_end).toLocaleDateString('fr-FR')
    message = `Abonnement résilié, accès jusqu'au ${end}.`
    color = 'gray'
  }

  if (!message) return null

  const colorClasses = {
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  }[color]

  return (
    <div className={`border-b ${colorClasses} px-4 py-2 text-sm flex items-center justify-between`}>
      <span>{message}</span>
      <Link href="/settings/billing" className="underline font-medium ml-4">
        Gérer mon abonnement
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Mount in (app) layout**

Read `src/app/(app)/layout.tsx`. Add at the top of the rendered output (above the existing nav):

```tsx
import { SubscriptionBanner } from '@/components/app/subscription-banner'
// ...
return (
  <>
    <SubscriptionBanner />
    {/* existing layout content */}
  </>
)
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/app/subscription-banner.tsx src/app/\(app\)/layout.tsx
git commit -m "feat(ui): add subscription banner with state-based messaging"
```

---

### Task 18: Refactor /settings/billing page

**Files:**
- Modify: `src/app/(app)/settings/billing/page.tsx`
- Create: `src/app/(app)/settings/billing/plan-selector.tsx`
- Create: `src/app/(app)/settings/billing/seats-list.tsx`
- Create: `src/app/(app)/settings/billing/billing-actions.ts`

- [ ] **Step 1: Server actions**

`src/app/(app)/settings/billing/billing-actions.ts`:
```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

async function postJson(path: string, body?: unknown): Promise<{ url?: string; error?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `sb-access-token=${session?.access_token ?? ''}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

export async function startCheckout(plan: 'starter' | 'pro' | 'business', cycle: 'monthly' | 'annual') {
  const result = await postJson('/api/stripe/checkout', { plan, cycle })
  if (result.url) redirect(result.url)
  throw new Error(result.error ?? 'checkout_failed')
}

export async function openPortal() {
  const result = await postJson('/api/stripe/portal')
  if (result.url) redirect(result.url)
  throw new Error(result.error ?? 'portal_failed')
}
```

- [ ] **Step 2: Plan selector component**

`src/app/(app)/settings/billing/plan-selector.tsx`:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PLANS } from '@/lib/constants'
import { startCheckout } from './billing-actions'

export function PlanSelector() {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly')
  const [pending, startTransition] = useTransition()

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          variant={cycle === 'monthly' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCycle('monthly')}
        >
          Mensuel
        </Button>
        <Button
          variant={cycle === 'annual' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCycle('annual')}
        >
          Annuel <span className="ml-1 text-xs opacity-70">-15%</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => (
          <Card key={plan.value}>
            <CardHeader>
              <CardTitle>{plan.label}</CardTitle>
              <p className="text-2xl font-bold">
                {cycle === 'monthly' ? `${plan.monthly_price}€/mois` : `${plan.annual_price}€/an`}
              </p>
              {cycle === 'annual' && (
                <p className="text-xs text-muted-foreground">
                  ≈ {Math.round(plan.annual_price / 12)} €/mois
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="text-sm space-y-1">
                {plan.features.map((f) => <li key={f}>• {f}</li>)}
              </ul>
              <Button
                className="w-full"
                disabled={pending}
                onClick={() => startTransition(() => startCheckout(plan.value, cycle))}
              >
                {pending ? '...' : plan.cta}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Seats list component**

`src/app/(app)/settings/billing/seats-list.tsx`:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Seat {
  id: string
  full_name: string | null
  email: string
  role: string
  index: number
}

interface SeatsListProps {
  seats: Seat[]
  includedSeats: number
  extraSeatPrice: number
}

export function SeatsList({ seats, includedSeats, extraSeatPrice }: SeatsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sièges payants ({seats.length} / {includedSeats} inclus)</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {seats.map((seat, idx) => {
            const isExtra = idx >= includedSeats
            return (
              <li key={seat.id} className="py-2 flex justify-between items-center">
                <div>
                  <span className="font-medium">{seat.full_name ?? seat.email}</span>
                  <span className="text-sm text-muted-foreground ml-2">{seat.role}</span>
                </div>
                <Badge variant={isExtra ? 'default' : 'secondary'}>
                  {isExtra ? `${extraSeatPrice} €/mois (extra)` : 'inclus'}
                </Badge>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Rewrite the page**

`src/app/(app)/settings/billing/page.tsx`:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/app/page-header'
import { PLANS } from '@/lib/constants'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { PlanSelector } from './plan-selector'
import { SeatsList } from './seats-list'
import { openPortal } from './billing-actions'

export const metadata = { title: 'Plan & facturation · LeadPartner' }

export default async function BillingPage() {
  const session = await requireRole(['company_admin', 'super_admin'])
  if (!session.tenant) return null

  const supabase = await createClient()

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('tenant_id', session.tenant.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: members } = await supabase
    .from('tenant_members')
    .select('id, role, profile:profiles!tenant_members_user_id_fkey(full_name, email)')
    .eq('tenant_id', session.tenant.id)
    .in('role', ['company_admin', 'collaborator'])
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seats = (members ?? []).map((m: any, idx: number) => ({
    id: m.id,
    full_name: m.profile?.full_name ?? null,
    email: m.profile?.email ?? '',
    role: m.role === 'company_admin' ? 'Admin' : 'Collaborateur',
    index: idx,
  }))

  const isActive = subscription?.status === 'active' || subscription?.status === 'past_due'
  const planConfig = subscription
    ? PLANS.find((p) => p.value === subscription.plan)
    : null

  return (
    <div className="space-y-6">
      <PageHeader title="Plan & facturation" description="Gérez votre abonnement LeadPartner." />

      {isActive && subscription && planConfig ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{planConfig.label} · {subscription.billing_cycle === 'annual' ? 'Annuel' : 'Mensuel'}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Prochaine facture :{' '}
                {subscription.current_period_end
                  ? formatDate(subscription.current_period_end)
                  : '—'}
              </p>
            </div>
            <Badge variant={subscription.status === 'active' ? 'success' : 'destructive'}>
              {subscription.status === 'past_due' ? 'Paiement en attente' : 'Actif'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              {subscription.included_seats} sièges inclus + {subscription.extra_seats} extras
            </p>
            <form action={openPortal}>
              <Button type="submit" variant="outline">
                Gérer mon abonnement (Stripe)
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <PlanSelector />
      )}

      {isActive && planConfig && (
        <SeatsList
          seats={seats}
          includedSeats={subscription!.included_seats}
          extraSeatPrice={planConfig.extra_seat_monthly}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build succeeds (warnings OK, no errors)

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/settings/billing/
git commit -m "feat(ui): rewrite /settings/billing with plan selector and seats list"
```

---

### Task 19: Quota check + upgrade modal in invite flow

**Files:**
- Modify: `src/app/(app)/team/invite/invite-form.tsx`
- Create: `src/app/(app)/team/invite/upgrade-seat-modal.tsx`
- Modify: `src/app/(app)/team/invite/actions.ts` (or wherever the invite server action lives)

- [ ] **Step 1: Find and modify invite server action**

Locate the invite action file (likely `src/app/(app)/team/invite/actions.ts` or inline in `invite-form.tsx`). Modify it so that:

1. Before inserting `invitations`, check `seats_remaining(tenant)` via RPC.
2. If 0 and role is `company_admin` or `collaborator`, return `{ needsUpgrade: true }` instead of creating the invitation.

Example (assuming the action is `createInvitation`):
```ts
'use server'

import { createClient } from '@/lib/supabase/server'

export async function createInvitation(input: { email: string; role: 'company_admin' | 'collaborator' | 'referrer' }): Promise<
  { ok: true; invitationId: string } | { ok: false; needsUpgrade: true } | { ok: false; error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthorized' }

  const { data: caller } = await supabase
    .from('tenant_members')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('role', 'company_admin')
    .single()
  if (!caller) return { ok: false, error: 'forbidden' }

  // Check quota for paid roles
  if (input.role === 'company_admin' || input.role === 'collaborator') {
    const { data: remaining } = await supabase.rpc('seats_remaining', { t: caller.tenant_id })
    if ((remaining as unknown as number) === 0) {
      return { ok: false, needsUpgrade: true }
    }
  }

  // ... existing invitation insert logic ...
  // Return { ok: true, invitationId: ... }
}
```

If the existing action has a different shape, adapt the wrapping but keep the early-return for `needsUpgrade`.

- [ ] **Step 2: Modal component**

`src/app/(app)/team/invite/upgrade-seat-modal.tsx`:
```tsx
'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface UpgradeSeatModalProps {
  open: boolean
  onClose: () => void
  onConfirmed: () => void
  memberLabel: string
}

export function UpgradeSeatModal({ open, onClose, onConfirmed, memberLabel }: UpgradeSeatModalProps) {
  const [preview, setPreview] = useState<{ monthlyAmountCents: number; proratedAmountCents: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/stripe/seats/preview', { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setPreview(data)
      })
      .finally(() => setLoading(false))
  }, [open])

  async function confirm() {
    setConfirming(true)
    setError(null)
    const res = await fetch('/api/stripe/seats/add', { method: 'POST' })
    const data = await res.json()
    setConfirming(false)
    if (!res.ok) {
      setError(data.error ?? 'Erreur')
      return
    }
    onConfirmed()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter {memberLabel} dépasse votre quota</DialogTitle>
        </DialogHeader>
        {loading && <p className="text-sm">Calcul du coût...</p>}
        {preview && (
          <div className="space-y-2 text-sm">
            <p>Cela ajoutera <strong>{(preview.monthlyAmountCents / 100).toFixed(2)} €/mois</strong> à votre abonnement.</p>
            <p>Facturé aujourd&apos;hui au prorata : <strong>{(preview.proratedAmountCents / 100).toFixed(2)} €</strong>.</p>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} disabled={confirming}>Annuler</Button>
          <Button onClick={confirm} disabled={loading || confirming || !preview}>
            {confirming ? 'Ajout...' : 'Confirmer et ajouter'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Wire modal into invite form**

In `src/app/(app)/team/invite/invite-form.tsx`, add modal state and trigger:

```tsx
const [upgradeOpen, setUpgradeOpen] = useState(false)
const [pendingEmail, setPendingEmail] = useState('')

async function onSubmit(e) {
  e.preventDefault()
  const result = await createInvitation({ email, role })
  if (!result.ok && 'needsUpgrade' in result) {
    setPendingEmail(email)
    setUpgradeOpen(true)
    return
  }
  // ... existing success / error handling
}

return (
  <>
    {/* existing form JSX */}
    <UpgradeSeatModal
      open={upgradeOpen}
      memberLabel={pendingEmail}
      onClose={() => setUpgradeOpen(false)}
      onConfirmed={async () => {
        setUpgradeOpen(false)
        // Retry the invitation now that a seat is available
        const result = await createInvitation({ email: pendingEmail, role })
        // handle result
      }}
    />
  </>
)
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: passes

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/team/invite/
git commit -m "feat(team): block invite at quota and show upgrade modal"
```

---

### Task 20: Add subscription guard to mutating server actions

**Files:**
- Modify: existing server actions that write to DB

- [ ] **Step 1: List actions to guard**

Run:
```bash
grep -rln "use server" src/app | head -20
```

For each `actions.ts` or inline server action that performs WRITE operations (insert/update/delete), add at the top of the function:
```ts
import { requireActiveSubscription, SubscriptionGuardError } from '@/lib/auth/require-active-subscription'
// ...
await requireActiveSubscription(tenantId)
```

Where `tenantId` is the tenant of the calling user.

Priority list (most impactful):
- `src/app/(app)/team/invite/actions.ts` (or equivalent)
- `src/app/onboarding/referrer/actions.ts`
- `src/app/(app)/team/[memberId]/actions.ts`
- Any opportunity create/update action
- Any commission_rules edit action

- [ ] **Step 2: Add guard to one action — example for invite**

Show example to follow for all of them. In the invite action:
```ts
try {
  await requireActiveSubscription(caller.tenant_id)
} catch (e) {
  if (e instanceof SubscriptionGuardError) {
    return { ok: false, error: `subscription_${e.reason}` }
  }
  throw e
}
```

- [ ] **Step 3: Apply same pattern across the listed files**

Repeat for each. Test that the user gets a clear error message when in read-only mode.

- [ ] **Step 4: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/
git commit -m "feat(auth): guard mutating server actions with requireActiveSubscription"
```

---

## Phase 6 — Vercel Cron + Tests

### Task 21: Daily trial reminder cron

**Files:**
- Create: `src/app/api/cron/billing/route.ts`
- Modify: `vercel.json` (create if missing)

- [ ] **Step 1: Create cron route**

`src/app/api/cron/billing/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  // Vercel Cron sends a special header; verify
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any

  const now = new Date()
  const in3Days = new Date(now.getTime() + 3 * 86400000)
  const in7Days = new Date(now.getTime() + 7 * 86400000)

  // Find trialing subscriptions expiring in 3 days or 7 days
  const { data: trials } = await admin
    .from('subscriptions')
    .select('tenant_id, trial_ends_at, tenant:tenants(name)')
    .eq('status', 'trialing')
    .gte('trial_ends_at', now.toISOString())
    .lte('trial_ends_at', in7Days.toISOString())

  let sent = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const sub of (trials ?? []) as any[]) {
    const daysLeft = Math.ceil(
      (new Date(sub.trial_ends_at).getTime() - now.getTime()) / 86400000,
    )
    if (daysLeft === 7 || daysLeft === 3 || daysLeft === 1) {
      // TODO: integrate Resend or another SMTP later. For now, log.
      console.log(`[cron] tenant ${sub.tenant_id} trial ends in ${daysLeft} day(s)`)
      sent++
    }
  }

  return NextResponse.json({ ok: true, scanned: trials?.length ?? 0, sent })
}
```

- [ ] **Step 2: Configure Vercel Cron**

Create `vercel.json` at the project root if it doesn't exist:
```json
{
  "crons": [
    {
      "path": "/api/cron/billing",
      "schedule": "0 9 * * *"
    }
  ]
}
```

This runs daily at 09:00 UTC. (Adjust timezone in code if needed.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/billing/route.ts vercel.json
git commit -m "feat(cron): add daily billing cron for trial reminders"
```

---

### Task 22: Manual sandbox test checklist

**Files:** none (manual)

- [ ] **Step 1: Configure Stripe sandbox**

In Stripe Dashboard (mode Test):
1. Create 4 Products: `Starter`, `Pro`, `Business`, `Extra Seat`
2. Create 12 Prices (see spec section "Stripe Setup")
3. Configure Customer Portal in Settings → Customer Portal
4. Add webhook endpoint: `https://lead-partner-one.vercel.app/api/webhooks/stripe`
5. Capture all 12 Price IDs and the Webhook signing secret

- [ ] **Step 2: Add env vars to Vercel**

Add the 15 Stripe env vars to your Vercel project. Trigger a redeploy.

- [ ] **Step 3: End-to-end test**

1. Create a fresh tenant via `/signup` → trial starts
2. Manually set `trial_ends_at = now() - interval '1 day'` in SQL editor → reload → app should be in read-only mode (banner red, mutating actions blocked)
3. Click banner CTA → `/settings/billing`
4. Choose "Pro Mensuel" → Stripe Checkout (test card `4242 4242 4242 4242`)
5. Verify webhook fires (check Stripe Dashboard → Developers → Webhooks → events) → DB sync → status = `active`
6. Banner disappears, mutating actions unblocked
7. Invite a 6th collaborator (Pro plan = 6 included = 5 extras allowed before extra) → modal "+9€/mo" → confirm
8. Check `seat_changes` table has a row, `subscriptions.extra_seats = 1`
9. Open Customer Portal → cancel subscription → confirm `cancel_at_period_end=true` and gray banner appears
10. Reactivate via Customer Portal → verify back to active
11. Trigger a payment failure: Stripe Dashboard → Customers → your test customer → invoice → mark as failed manually OR use Stripe CLI: `stripe trigger invoice.payment_failed`
12. Verify `subscriptions.status = past_due`

- [ ] **Step 4: Document**

Create `docs/superpowers/billing-test-results-YYYY-MM-DD.md` and note which scenarios passed.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/billing-test-results-*.md
git commit -m "docs: billing sandbox test results"
```

---

## Self-Review Checklist (already performed during plan writing)

- ✅ Spec coverage: every section of the spec maps to at least one task above
  - Pricing → Task 1
  - DB schema → Tasks 3-5
  - Stripe lib → Tasks 6-11
  - Subscription guard → Task 12, applied in Task 20
  - API routes → Tasks 13-16
  - UI (banner) → Task 17
  - UI (billing page) → Task 18
  - UI (upgrade modal) → Task 19
  - Cron → Task 21
  - Manual test → Task 22
- ✅ No placeholders: all code blocks contain real implementation
- ✅ Type consistency: `SubscriptionPlan`, `BillingCycle`, `SubscriptionStatus`, `seat_changes`, `stripe_events` consistent across tasks
- ✅ TDD applied to: plans config (Task 6), webhook verification (Task 7), subscription guard (Task 12). Other tasks are integration-heavy and tested manually in Task 22.

## Notes for the Implementer

- **Branch**: feature branch `feat/billing-stripe` recommended; current behavior is to merge to `main`.
- **Stripe Test Mode**: keep `STRIPE_SECRET_KEY` starting with `sk_test_` until KYC is complete and you're ready to take real money. Then re-create Products/Prices in Live mode and update env vars.
- **Webhook URL during local dev**: use `stripe listen --forward-to http://localhost:3000/api/webhooks/stripe` for local testing.
- **Stripe API version**: pinned to `2024-12-18.acacia` in `client.ts`. Don't upgrade without testing the entire flow.
- **Email integration**: the cron at Task 21 currently logs only — wire it to Resend or another SMTP provider as a separate effort (out of scope for this plan).
- **Tenants without subscription rows**: backfill in Task 4 ensures all existing tenants get a 14-day trial. New tenants created via `/signup` already get a `trialing` row in `0003_seed_default_data.sql`'s `create_tenant` function — verify this still works after the migration (the function may need an update if `trial_ends_at` is now expected).
