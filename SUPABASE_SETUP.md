# Configuration Supabase — Pas à pas

## 1. Créer le projet

1. Allez sur [supabase.com](https://supabase.com) → **New project**
2. Nom : `leadpartner` (ou ce que vous voulez)
3. Mot de passe DB : générez un mot de passe robuste, conservez-le
4. Région : la plus proche de vos utilisateurs

## 2. Récupérer les clés

Dans **Project Settings > API** :

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (à garder secret, jamais côté client)

Reportez ces valeurs dans `.env.local`.

## 3. Configurer Auth

Dans **Authentication > Providers > Email** :

- ✅ **Enable Email provider**
- Pour le développement : ⛔ Désactiver "Confirm email" (optionnel)
- En production : ✅ Activer "Confirm email"

Dans **Authentication > URL Configuration** :

- **Site URL** : `http://localhost:3000` en dev, `https://leadpartner.app` en prod
- **Redirect URLs** : ajoutez
  - `http://localhost:3000/auth/callback`
  - `https://leadpartner.app/auth/callback`

## 4. Exécuter les migrations

Dans **SQL Editor** :

### Étape 1 — Schéma

Copiez/collez le contenu de `supabase/migrations/0001_initial_schema.sql` puis cliquez **Run**.

Vérifiez que les tables suivantes apparaissent dans **Table Editor** :

- `profiles`, `tenants`, `tenant_members`, `programs`, `referral_links`
- `opportunities`, `opportunity_fields`, `opportunity_status_history`
- `commission_rules`, `commissions`
- `documents`, `subscriptions`, `invitations`

### Étape 2 — Politiques RLS

Copiez/collez le contenu de `supabase/migrations/0002_rls_policies.sql` puis **Run**.

Vérifiez : **Authentication > Policies** doit afficher de nombreuses policies pour chaque table. Toutes les tables doivent avoir le badge "RLS enabled".

### Étape 3 — Fonctions et seeds

Copiez/collez le contenu de `supabase/migrations/0003_seed_default_data.sql` puis **Run**.

## 5. (Optionnel) Créer un super admin

Créez d'abord un compte normal via l'app (`/signup`), puis dans **SQL Editor** :

```sql
update public.profiles
set is_super_admin = true
where email = 'votre-email@exemple.com';
```

Reconnectez-vous : vous serez redirigé vers `/super-admin`.

## 6. Tests rapides

Lancez l'app : `npm run dev`

1. **Inscription** → `/signup` avec un email/mot de passe
2. **Onboarding** → wizard de création de l'entreprise (4 étapes)
3. **Dashboard admin** → vous arrivez sur le dashboard de votre tenant
4. **Inviter un apporteur** → `/team/invite`, copiez le lien généré
5. **Activer la page publique** → `/program`, toggle "Page publique d'inscription"
6. **Tester la page publique** → ouvrez `/p/<slug-de-votre-entreprise>` en navigation privée

## 7. Storage (optionnel)

Pour stocker les pièces jointes des opportunités, créez un bucket :

```sql
insert into storage.buckets (id, name, public)
values ('opportunity-documents', 'opportunity-documents', false);

create policy "Tenant members can read"
  on storage.objects for select
  using (
    bucket_id = 'opportunity-documents'
    and exists (
      select 1 from public.documents d
      where d.file_path = name
        and public.is_member_of(d.tenant_id)
    )
  );
```

## Dépannage

### "permission denied for schema public"

Vérifiez que vous avez bien exécuté les 3 migrations dans l'ordre.

### Boucle de redirection /onboarding

C'est normal pour un nouveau compte sans tenant. Complétez le wizard.

### "function create_tenant does not exist"

Réexécutez `0003_seed_default_data.sql`.

### Les tables ne sont pas visibles

Vérifiez le schéma dans **Table Editor > schema selector** : choisissez `public`.
