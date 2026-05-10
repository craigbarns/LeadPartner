# LeadPartner

> SaaS multi-tenant qui permet à n'importe quelle entreprise de lancer son propre programme d'apporteurs d'affaires.
>
> **Production : [leadpartner.app](https://leadpartner.app)**

LeadPartner est une plateforme par abonnement. Chaque entreprise cliente dispose de son espace isolé (multi-tenant strict) avec ses utilisateurs, ses apporteurs, ses opportunités, ses règles de commission et son branding personnalisable. Le logiciel ne vend pas de leads — il fournit l'outil de gestion du programme.

---

## Sommaire

1. [Stack technique](#stack-technique)
2. [Architecture](#architecture)
3. [Installation locale](#installation-locale)
4. [Configuration Supabase](#configuration-supabase)
5. [Structure du projet](#structure-du-projet)
6. [Modèle de données](#modèle-de-données)
7. [Sécurité (RLS)](#sécurité-rls)
8. [Déploiement](#déploiement)
9. [Roadmap](#roadmap)

---

## Stack technique

- **Next.js 15** (App Router, Server Components, Server Actions)
- **TypeScript** strict
- **Tailwind CSS 3** + **shadcn/ui** (composants Radix)
- **Supabase** (Postgres + Auth + RLS + Storage)
- **lucide-react** (icônes), **sonner** (toasts), **recharts** (charts)

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  Next.js App Router                      │
├──────────────────────────────────────────────────────────┤
│  / (landing)                                             │
│  /(auth)/login, /signup, /forgot-password                │
│  /onboarding (wizard 4 étapes — création tenant)         │
│  /(app)/* (espace authentifié multi-tenant)              │
│      dashboard, opportunities, commissions, team,        │
│      program, referral, settings, account                │
│  /super-admin/* (espace global LeadPartner)              │
│  /p/[slug] (page publique inscription apporteur)         │
│  /invite/[token] (acceptation invitation)                │
└──────────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────┐
│               Supabase (Postgres + Auth)                 │
│   tenants, profiles, tenant_members, programs,           │
│   referral_links, opportunities, opportunity_fields,     │
│   opportunity_status_history, commission_rules,          │
│   commissions, documents, subscriptions, invitations     │
│                                                          │
│   RLS policies → isolation stricte par tenant_id         │
└──────────────────────────────────────────────────────────┘
```

### Quatre rôles

| Rôle              | Accès                                                               |
| ----------------- | ------------------------------------------------------------------- |
| `super_admin`     | Toutes les entreprises, abonnements, statistiques globales          |
| `company_admin`   | Tout dans son tenant : programme, équipe, opportunités, commissions |
| `collaborator`    | Opportunités du tenant, mise à jour des statuts                     |
| `referrer`        | Ses propres opportunités, ses commissions, son lien de parrainage   |

## Installation locale

### Prérequis

- Node.js 20+
- npm 10+
- Un projet Supabase (gratuit)

### Étapes

```bash
# 1. Cloner le projet
cd LEADPARTNER

# 2. Installer les dépendances
npm install

# 3. Copier le fichier d'environnement
cp .env.example .env.local

# 4. Renseigner les variables d'environnement (voir section Supabase)
#    NEXT_PUBLIC_SUPABASE_URL
#    NEXT_PUBLIC_SUPABASE_ANON_KEY
#    SUPABASE_SERVICE_ROLE_KEY

# 5. Démarrer le serveur de développement
npm run dev
```

L'application est accessible sur [http://localhost:3000](http://localhost:3000).

## Configuration Supabase

### 1. Créer un projet Supabase

Rendez-vous sur [supabase.com](https://supabase.com) et créez un projet.

Récupérez les variables suivantes (Project Settings > API) :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### 2. Exécuter les migrations SQL

Trois scripts à exécuter dans l'ordre, depuis l'éditeur SQL Supabase :

```sql
-- 1. Schéma initial (tables, enums, triggers)
-- Voir : supabase/migrations/0001_initial_schema.sql

-- 2. Politiques de sécurité Row Level Security
-- Voir : supabase/migrations/0002_rls_policies.sql

-- 3. Fonctions utilitaires + seeds par secteur
-- Voir : supabase/migrations/0003_seed_default_data.sql
```

Vous pouvez les copier/coller un par un dans l'onglet **SQL Editor** de Supabase, ou utiliser la CLI Supabase :

```bash
npx supabase login
npx supabase link --project-ref <votre-project-ref>
npx supabase db push
```

### 3. Configuration Auth

Dans **Authentication > Providers > Email** :

- Activez l'inscription par email/password
- (Optionnel) Désactivez la confirmation email pour tester rapidement
- Configurez l'URL de redirection : `http://localhost:3000/auth/callback`

### 4. (Optionnel) Créer un super admin

Dans l'éditeur SQL Supabase, après avoir créé un compte via l'app :

```sql
update public.profiles
set is_super_admin = true
where email = 'admin@leadpartner.app';
```

Cette personne aura accès au panneau `/super-admin`.

## Structure du projet

```
src/
├── app/
│   ├── (auth)/                 # login, signup, forgot/reset password
│   ├── (app)/                  # espace tenant authentifié
│   │   ├── dashboard/          # dashboard admin/collab + /referrer
│   │   ├── opportunities/      # liste, création, détail
│   │   ├── commissions/        # suivi + actions
│   │   ├── team/               # équipe + invitations
│   │   ├── referrers/          # vue dédiée apporteurs (admin)
│   │   ├── program/            # config programme + page publique
│   │   ├── referral/           # lien de parrainage personnel
│   │   ├── settings/           # branding, fields, billing, commissions
│   │   └── account/            # profil utilisateur
│   ├── super-admin/            # console super admin
│   ├── onboarding/             # wizard 4 étapes (création tenant)
│   ├── p/[slug]/               # page publique inscription apporteur
│   ├── invite/[token]/         # acceptation d'invitation
│   ├── auth/callback/          # callback OAuth/magic link
│   ├── page.tsx                # landing
│   └── layout.tsx
├── components/
│   ├── ui/                     # shadcn/ui (button, card, table, …)
│   └── app/                    # sidebar, header, stat-card, …
├── lib/
│   ├── supabase/               # client, server, middleware
│   ├── auth.ts                 # getSession, requireSession, requireRole, requireTenant
│   ├── constants.ts            # secteurs, statuts, rôles, plans
│   └── utils.ts                # cn, formatters, slugify
├── types/
│   └── database.ts             # types Supabase
└── middleware.ts               # protection des routes

supabase/
└── migrations/
    ├── 0001_initial_schema.sql
    ├── 0002_rls_policies.sql
    └── 0003_seed_default_data.sql
```

## Modèle de données

13 tables principales :

| Table                          | Rôle                                                |
| ------------------------------ | --------------------------------------------------- |
| `tenants`                      | Entreprises clientes (multi-tenant root)            |
| `profiles`                     | Extension de `auth.users`                           |
| `tenant_members`               | Rôle d'un user dans un tenant + code de parrainage  |
| `programs`                     | Programmes d'apporteurs (1 par tenant en MVP)       |
| `referral_links`               | Liens de parrainage avec quotas / expirations       |
| `opportunities`                | Opportunités déclarées                              |
| `opportunity_fields`           | Champs personnalisés par secteur d'activité         |
| `opportunity_status_history`   | Historique des changements de statut (trigger)      |
| `commission_rules`             | Règles de commission (fixe / % / paliers)           |
| `commissions`                  | Commissions calculées                               |
| `documents`                    | Pièces jointes (à brancher sur Supabase Storage)    |
| `subscriptions`                | Plan & statut d'abonnement (Stripe à intégrer)      |
| `invitations`                  | Invitations email avec token unique                 |

### Statuts d'opportunité

`new` → `qualified` → `assigned` → `contacted` → `meeting_booked` → `proposal_sent` → `contract_signed` → `sale_closed` → `commission_due` → `commission_paid`

Statuts terminaux : `rejected`, `lost`.

### Statuts de commission

`estimated` → `due` → `validated` → `paid` (ou `canceled`).

## Sécurité (RLS)

Toutes les tables sont protégées par **Row Level Security**. Les helpers SQL principaux :

- `is_super_admin()` — true si `profiles.is_super_admin = true`
- `is_member_of(tid)` — true si user actif dans tenant `tid`
- `is_admin_of(tid)` — true si user est `company_admin` actif
- `is_collaborator_of(tid)` — true si `company_admin` ou `collaborator`
- `is_referrer_of(tid)` — true si `referrer` actif

Règles clés :

- Un apporteur ne voit **que** ses propres opportunités et commissions.
- Un collaborateur voit toutes les opportunités de son tenant, mais pas la liste des autres tenants.
- Un admin entreprise gère son tenant uniquement.
- Le super admin a accès en lecture/écriture à tout.

## Déploiement

### Vercel (recommandé)

```bash
# 1. Connecter le repo à Vercel
# 2. Définir les variables d'environnement :
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
#   NEXT_PUBLIC_APP_URL=https://leadpartner.app
#
# 3. Domaine personnalisé : Settings > Domains → ajouter "leadpartner.app"
#    Vercel pousse automatiquement HTTPS (HSTS preload requis pour .app)
#
# 4. Build automatique sur push (main → production)
```

### DNS — `.app` requiert HTTPS

Comme tous les TLDs Google (`.app`, `.dev`, `.page`), `leadpartner.app` est dans la liste **HSTS preload**.
Cela signifie : aucun navigateur ne servira `http://leadpartner.app` — uniquement `https://`.
Vercel fournit automatiquement le certificat SSL et redirige `apex` ↔ `www`.

| Type | Nom | Valeur |
|------|-----|--------|
| `A` | `@` | `76.76.21.21` (Vercel) |
| `CNAME` | `www` | `cname.vercel-dns.com.` |

### Supabase

- Activez **Authentication > URL configuration** : ajoutez votre URL de production dans les redirect URLs.
- (Optionnel) Configurez un bucket Storage pour les documents.

## Roadmap

- [ ] Intégration Stripe (subscriptions, webhooks)
- [ ] Upload et stockage des documents (Supabase Storage)
- [ ] Notifications email (Resend) sur changement de statut
- [ ] Domaine personnalisé par tenant via middleware
- [ ] Édition complète des champs personnalisés (UI builder)
- [ ] Calcul automatique des commissions à la fermeture d'une opportunité
- [ ] Export CSV des opportunités/commissions
- [ ] Mobile app (React Native ou PWA)

## Licence

Propriétaire. Tous droits réservés.
