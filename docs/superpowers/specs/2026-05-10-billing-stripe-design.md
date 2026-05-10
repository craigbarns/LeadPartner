# Billing & Subscriptions (Stripe) — Design Spec

**Date:** 2026-05-10
**Status:** Approved (ready for implementation plan)
**Author:** Gregory Baranes

## Context

LeadPartner is a multi-tenant Next.js + Supabase SaaS for managing referral programs and commissions. Today the app has no real billing: a `subscriptions` table exists with `plan` and `status` columns but no Stripe integration, no quota enforcement, no trial expiration logic. Anyone can use the app indefinitely for free.

The product is now feature-complete enough to charge for it. Target customers are real estate agencies, insurance brokers, and similar B2B verticals where a single tenant has 1 admin + multiple collaborators (the agents/staff) + many referrers (external clients/contacts who bring leads).

We integrate **Stripe** for self-service subscription management with seat-based pricing, a 14-day trial, and read-only fallback when payment fails or trial expires.

## Goals

- **Per-seat pricing** for paid users (admin + collaborators). Referrers (external lead-bringers) remain free and unlimited — this is a strong commercial argument.
- **Three plans** (Starter / Pro / Business) with included seats and dégressif extra-seat pricing.
- **Monthly + annual billing** (annual = -15% discount, paid upfront).
- **14-day free trial** at tenant creation, no credit card required upfront.
- **Smooth over-quota flow**: admin gets a confirmation modal ("+9€/mo"), confirms, the seat is added with proration, Stripe charges immediately.
- **Soft enforcement at expiration**: read-only mode + persistent banner instead of hard lockout. Data preserved indefinitely.
- **Self-service** via Stripe Customer Portal for card updates, invoice access, and cancellation.
- **Stripe-driven sync**: webhooks are the source of truth for `subscriptions` state.

## Non-Goals

- **Usage-based metering** (per-opportunity, per-PDF, etc.) — out of scope; pure seat-based pricing.
- **Custom enterprise plans** with negotiated pricing — handled manually outside the app for v1.
- **Multi-currency**: EUR only.
- **Tax handling** beyond what Stripe Tax can do automatically (we'll enable Stripe Tax for FR VAT, but not implement custom tax logic).
- **Prorated refunds on seat removal**: when a collab leaves, the extra seat is removed at the end of the period, no immediate credit (standard SaaS practice).
- **Coupons / promo codes**: deferred to a later iteration.
- **Affiliate / partner program** for the SaaS itself: deferred.

## Pricing Model

| Plan | Monthly | Annual (-15%) | Included seats | Extra seat (monthly) |
|---|---|---|---|---|
| **Starter** | 29 € | 296 € (≈25 €/mo) | 1 admin + 2 collabs (3 total) | +12 €/seat/mo |
| **Pro** | 79 € | 806 € (≈67 €/mo) | 1 admin + 5 collabs (6 total) | +9 €/seat/mo |
| **Business** | 199 € | 2030 € (≈169 €/mo) | 1 admin + 15 collabs (16 total) | +6 €/seat/mo |

- **Referrers**: unlimited on all plans, free.
- **Annual extra seats**: 12 × monthly × 0.85 (also -15%).
- A **paid seat** = a `tenant_member` row with `status='active'` and `role IN ('company_admin', 'collaborator')`. Referrers are not counted.

### Trial & Lifecycle

```
Day 0  : Tenant signs up → 14-day trial starts (no card required)
Day 11 : Email "Trial ends in 3 days"
Day 13 : Email "Trial ends tomorrow"
Day 14 : Trial expires → tenant goes to read-only mode + red banner
        (data preserved, mutations blocked until subscription is activated)
Anytime: Admin clicks "Activate" → Stripe Checkout → subscription becomes active
Monthly: Stripe charges card automatically; if fail → grace 3 days → past_due → unpaid
Cancel : Admin cancels via Customer Portal → cancel_at_period_end=true,
         access continues until end of paid period, then read-only
```

### Over-quota flow (adding a paid seat)

1. Admin invites a new collab via `/team/invite`.
2. Server checks `seats_remaining(tenant)`. If ≥1, proceeds normally.
3. If 0, returns `{ needsUpgrade: true, extraCost: 9, prorated: 4.20 }` (numbers based on the active plan + days remaining in current period).
4. Front displays a modal: **"Adding Marie exceeds your quota. +9€/mo will be added (prorated 4.20€ today). Card on file: •••• 4242. Confirm?"**
5. On confirm: Stripe `subscription.update({ items: [...], proration_behavior: 'always_invoice' })` — adds the extra seat quantity, creates and charges a prorated invoice immediately.
6. Webhook `customer.subscription.updated` syncs `extra_seats++` in DB.
7. Server completes the original invitation insert.
8. `seat_changes` row inserted for audit.

### Read-only mode

Triggered when subscription status ∈ {`canceled`, `unpaid`, `incomplete_expired`} or when `status='trialing' AND trial_ends_at < now()`.

**Allowed**: GET on all `(app)` routes (read), `/settings/billing` (full access), `/login`, `/api/webhooks/*`.

**Blocked** (with `subscription_inactive` error):
- `/api/contracts/send` (no new contracts)
- All server actions that write data: `/team/invite`, opportunity create/update, commission rules edit, etc.
- All POST/PUT/DELETE on app routes

A persistent red banner appears at the top of every page with a CTA to `/settings/billing`.

## Data Model Changes

### Migration: `supabase/migrations/0007_billing_schema.sql`

```sql
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

### Backfill (separate query, after migration)

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

## Stripe Setup

**Account-level setup** (done once in Stripe Dashboard, mode Test first then Live):

1. Create the Stripe account, complete KYC eventually.
2. Enable **Stripe Tax** for FR VAT auto-handling.
3. Configure **Customer Portal**: enable "Update payment method", "View invoices", "Cancel subscription".
4. Create **4 Products**:
   - LeadPartner Starter
   - LeadPartner Pro
   - LeadPartner Business
   - LeadPartner Extra Seat
5. Create **Prices** (12 total, recurring):

| Plan | Cycle | Amount | ID env var |
|---|---|---|---|
| Starter | monthly | 29 € | `STRIPE_PRICE_STARTER_MONTHLY` |
| Starter | annual | 296 € | `STRIPE_PRICE_STARTER_ANNUAL` |
| Pro | monthly | 79 € | `STRIPE_PRICE_PRO_MONTHLY` |
| Pro | annual | 806 € | `STRIPE_PRICE_PRO_ANNUAL` |
| Business | monthly | 199 € | `STRIPE_PRICE_BUSINESS_MONTHLY` |
| Business | annual | 2030 € | `STRIPE_PRICE_BUSINESS_ANNUAL` |
| Extra (Starter) | monthly | 12 € | `STRIPE_PRICE_EXTRA_SEAT_STARTER_MONTHLY` |
| Extra (Starter) | annual | 122 € (12×12×0.85) | `STRIPE_PRICE_EXTRA_SEAT_STARTER_ANNUAL` |
| Extra (Pro) | monthly | 9 € | `STRIPE_PRICE_EXTRA_SEAT_PRO_MONTHLY` |
| Extra (Pro) | annual | 92 € (9×12×0.85) | `STRIPE_PRICE_EXTRA_SEAT_PRO_ANNUAL` |
| Extra (Business) | monthly | 6 € | `STRIPE_PRICE_EXTRA_SEAT_BUSINESS_MONTHLY` |
| Extra (Business) | annual | 61 € (6×12×0.85) | `STRIPE_PRICE_EXTRA_SEAT_BUSINESS_ANNUAL` |

6. Configure **Webhooks**: endpoint `https://lead-partner-one.vercel.app/api/webhooks/stripe`, events listed below.

### Webhook events handled

| Event | Action |
|---|---|
| `checkout.session.completed` | Subscription created → DB sync, status='active' |
| `customer.subscription.updated` | Plan changed / seats added / cancel scheduled → DB sync |
| `customer.subscription.deleted` | Cancellation effective → status='canceled' |
| `invoice.paid` | Update period dates, payment receipt sent (Stripe handles email) |
| `invoice.payment_failed` | Status → past_due (Stripe handles retries) |
| `customer.subscription.trial_will_end` | Trial ends in 3 days → trigger reminder email |

## Architecture

### New files

```
src/lib/stripe/
├── client.ts              # Stripe SDK initialization (server only)
├── plans.ts               # Static config: plan codes → Stripe Price IDs
├── checkout.ts            # createCheckoutSession() for new subscriptions
├── portal.ts              # createCustomerPortalSession() for self-service
├── seats.ts               # addSeat(), removeSeat() with proration
├── subscription-sync.ts   # syncSubscriptionFromStripe() — idempotent DB sync
└── webhook-events.ts      # handleEvent() — routes events to handlers

src/lib/auth/
└── require-active-subscription.ts  # guards server actions and API routes

src/app/api/stripe/
├── checkout/route.ts      # POST → returns Stripe Checkout URL
├── portal/route.ts        # POST → returns Customer Portal URL
└── webhook/route.ts       # POST events from Stripe (HMAC + dedup)

src/app/(app)/settings/billing/
├── page.tsx               # (rewrite existing) overview: plan, seats, next bill
├── plan-selector.tsx      # Monthly/annual toggle + 3 plan cards
├── seats-list.tsx         # Paid seats list (included vs extras)
└── upgrade-seat-modal.tsx # "+9€/mo" confirmation modal

src/components/app/
└── subscription-banner.tsx  # Persistent top banner (trial/expired/past_due states)
```

### Modified files

- `src/middleware.ts` / `src/lib/supabase/middleware.ts` — add subscription guard for read-only mode
- `src/lib/constants.ts` — update PLANS to match new pricing (29/79/199 instead of 49/149)
- `src/app/(app)/team/invite/invite-form.tsx` — add quota check, trigger upgrade modal when needed
- `src/app/(app)/team/invite/actions.ts` (or equivalent) — return `needsUpgrade` payload
- `src/app/(app)/layout.tsx` — render `<SubscriptionBanner />`
- All server actions that mutate data — add `requireActiveSubscription()` call

### Stack additions

- **`stripe` npm package** (Node SDK)
- No new framework dependency. Uses existing fetch for any HTTP-only operations.

### New environment variables (~15)

```
# Stripe API
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs (12)
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_ANNUAL=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
STRIPE_PRICE_BUSINESS_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_ANNUAL=price_...
STRIPE_PRICE_EXTRA_SEAT_STARTER_MONTHLY=price_...
STRIPE_PRICE_EXTRA_SEAT_STARTER_ANNUAL=price_...
STRIPE_PRICE_EXTRA_SEAT_PRO_MONTHLY=price_...
STRIPE_PRICE_EXTRA_SEAT_PRO_ANNUAL=price_...
STRIPE_PRICE_EXTRA_SEAT_BUSINESS_MONTHLY=price_...
STRIPE_PRICE_EXTRA_SEAT_BUSINESS_ANNUAL=price_...
```

## UI

### `/settings/billing`

Three states based on subscription status:

**Trial active**: yellow banner "X days left", plan selector cards (3 plans, monthly/annual toggle), CTA "Choose a plan" per card.

**Subscription active**: shows current plan + cycle, current bill ("79 € + 18 € for 2 extra seats = 97 €/mo"), next billing date, masked card; below: list of paid seats with badges (included / extra €), "Manage subscription" button → Customer Portal, danger zone with "Change plan" / "Cancel".

**Trial expired or payment failed**: red banner "Read-only mode, reactivate"; plan selector below.

### Modal: upgrade seat (over-quota)

Triggered from `/team/invite` when admin tries to invite past quota. Displays:
- Member to add
- Current plan + quota usage
- Cost added (per month + prorated for the day)
- Card on file
- [Cancel] [Confirm and add]

### `<SubscriptionBanner />` global

Renders at top of `(app)` layout. Shows nothing if subscription has >7 days left in trial or is healthy active. Otherwise shows yellow/orange/red banner with one-line message + CTA.

States and copy:
| State | Color | Copy |
|---|---|---|
| Trial 3-7d | yellow | "Essai : X jours restants. Configurez votre plan" |
| Trial 0-2d | orange | "Essai expire dans X jours. Activez maintenant" |
| Trial expired | red | "Compte en lecture seule. Activer mon abonnement" |
| past_due | red | "Paiement échoué. Mettez à jour votre carte" |
| cancel_at_period_end | gray | "Abonnement résilié, accès jusqu'au DD/MM/YYYY" |

## Email notifications

Sent via the existing email infrastructure (Supabase Auth emails for now, Resend later when we set up custom SMTP — out of scope for this spec). Triggered server-side from cron-like daily checks (Vercel Cron) or webhook handlers.

| Email | Trigger | Subject |
|---|---|---|
| Welcome | Tenant created | "Bienvenue — votre essai démarre" |
| Trial -7d | Daily cron, 7 days before `trial_ends_at` | "7 jours d'essai restants" |
| Trial -3d | Daily cron | "3 jours d'essai restants" |
| Trial expired | Daily cron, on expiration day | "Votre compte est en lecture seule" |
| Payment OK | `invoice.paid` | "Reçu de paiement" (Stripe attaches PDF) |
| Payment failed | `invoice.payment_failed` | "Action requise : mise à jour de votre paiement" |
| Seat added | After `seat_changes` insert | "Marie a été ajoutée (+9€/mo)" |
| Cancellation scheduled | `customer.subscription.updated` with `cancel_at_period_end=true` | "Confirmation de résiliation" |

A daily Vercel Cron at 09:00 Europe/Paris triggers `/api/cron/billing` which scans subscriptions and sends the trial reminder emails as needed.

## Edge Cases

| Case | Behavior |
|---|---|
| Tenant has no subscription row (legacy data) | Backfill creates one in `trialing` for 14 days |
| Admin cancels during trial | Trial continues until `trial_ends_at`, then read-only |
| Admin cancels active sub | `cancel_at_period_end=true`, access until end of period, then read-only |
| Admin reactivates a scheduled cancel | Customer Portal → reactivate → webhook → DB sync |
| Admin removes a paid extra collab | `extra_seats--` at end of period, no immediate refund |
| Admin downgrades Pro→Starter with 6 collabs | Reject with error: "Remove X collabs before downgrading" |
| Card expires | Stripe retries 4× over 7 days, then `past_due`, then `unpaid` after 30 days |
| Webhook arrives twice (network retry) | Deduped via `stripe_events.stripe_event_id` unique index |
| Race: 2 webhooks update subscription concurrently | Last-write-wins on `subscriptions` row; events log preserves history |
| Tenant deleted while sub active | Hard delete is reserved to super-admin: super-admin first cancels the Stripe subscription via Stripe Dashboard, then deletes the tenant in the app (cascade removes the `subscriptions` row). The DB cascade alone does NOT cancel Stripe — manual cancellation is required to stop billing. |
| Read-only bypass attempt via API | Server-side `requireActiveSubscription()` check on every mutation |
| Customer Portal accessed by non-admin | `requireRole('company_admin')` before generating URL |

## Security

- **Webhook HMAC**: every `/api/webhooks/stripe` request must have valid Stripe signature (`STRIPE_WEBHOOK_SECRET`); reject 401 otherwise. Same pattern as Yousign.
- **Idempotency**: `stripe_events` table dedups by event ID.
- **RLS**: `stripe_events` is service role only; `seat_changes` readable by admins of the tenant.
- **Authorization**: `/api/stripe/checkout` and `/api/stripe/portal` require `company_admin` role.
- **PII**: no PII added to logs (no card numbers — Stripe handles all PCI scope; we only store `last4` if shown in UI, fetched on demand from Stripe).
- **3DS / SCA**: handled automatically by Stripe Checkout and Customer Portal.

## Testing Strategy

### Unit tests

- `lib/stripe/plans.test.ts` — price IDs match expected mapping; pricing math sanity (annual ≈ monthly × 12 × 0.85)
- `lib/stripe/webhook-events.test.ts` — valid HMAC accepted, invalid rejected, unknown event ignored, duplicate event dedup
- `lib/stripe/seats.test.ts` — proration calculation correct for various days-remaining scenarios
- `lib/stripe/subscription-sync.test.ts` — idempotent (calling twice with same Stripe state yields same DB state)
- `lib/auth/require-active-subscription.test.ts` — all status combinations behave correctly (active, trialing/not-expired, trialing/expired, past_due, canceled)

### Integration tests

- Trial expired → invite collab → action throws `trial_expired`
- Quota full → invite → server returns `needsUpgrade=true` → confirm via mocked Stripe → seat added + audit row
- Webhook idempotency: post same event twice → processed once
- Webhook with bad HMAC → 401
- Read-only mode: GET works, POST throws

### Manual sandbox tests (Stripe CLI)

```bash
stripe listen --forward-to https://lead-partner-one.vercel.app/api/webhooks/stripe
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

End-to-end on a test tenant:
1. New signup → trial starts → use the app
2. Manually move `trial_ends_at` to yesterday → reload → read-only mode
3. Click "Activate" → Stripe Checkout (test card `4242 4242 4242 4242`) → subscription active
4. Invite collab beyond quota → modal → confirm → seat added
5. Customer Portal → cancel → verify `cancel_at_period_end=true` and banner appears
6. Trigger payment_failed → verify status → past_due

## Rollout

### Phase 1 — Pre-deploy preparation

1. Create Stripe account (mode Test). KYC can wait until Phase 4.
2. Create 4 Products + 12 Prices in Stripe Dashboard.
3. Configure Customer Portal (enable update payment, view invoices, cancel).
4. Enable Stripe Tax for FR VAT.
5. Capture all 12 Price IDs.

### Phase 2 — Code deploy

6. Apply migration `0007_billing_schema.sql` in Supabase SQL Editor.
7. Run backfill SQL (existing tenants get a 14-day trial).
8. Add 15 env vars to Vercel (Production + Preview).
9. Configure webhook endpoint in Stripe Dashboard pointing to `/api/webhooks/stripe`.
10. Push code → Vercel auto-deploys.

### Phase 3 — Sandbox tests

11. Test full flow with Stripe test mode (cards from Stripe testing docs).
12. Test add/remove seat, cancellation, payment failure.
13. Test trial expiration by manually changing `trial_ends_at`.

### Phase 4 — Production switch

14. Complete Stripe KYC (1-3 days).
15. Activate Live mode in Stripe; recreate Products/Prices in Live (or use Stripe CLI to clone).
16. Update Vercel env vars with Live Price IDs.
17. Update webhook endpoint to Live mode.
18. Final test with a real card on a test account.
19. Communicate pricing rollout to existing tenants by email.

### Phase 5 — Communication

20. Send email to existing tenants: "From DD/MM, subscriptions are required. Your 14-day trial starts today."
21. Publish pricing page on the marketing site (out of scope for this spec).

## Metrics

To add to `/super-admin/analytics` after rollout:

- MRR (Monthly Recurring Revenue) — sum of all active monthly equivalents
- Tenants by status: trialing / active / past_due / canceled
- Trial → paid conversion rate
- Monthly churn rate
- ARPU (Average Revenue Per Tenant)
- Total paid seats sold (and breakdown included vs extras)

## Open Questions

None at this time.

## Future Work (out of scope)

- Coupons / promotional codes
- Custom enterprise plans with negotiated pricing (manual today)
- Usage-based add-ons (e.g., per-PDF charges, per-Yousign-signature)
- Multi-currency (USD, GBP)
- Affiliate program for the SaaS itself
- In-app pricing page (currently only public marketing site planned)
- Automated dunning workflow (custom emails on past_due)
