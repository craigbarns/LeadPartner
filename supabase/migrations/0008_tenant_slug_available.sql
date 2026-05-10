-- Vérifie si un slug tenant est libre (onboarding). Security definer car la RLS
-- "tenants_member_read" n'autorise pas la lecture globale des slugs.

create or replace function public.tenant_slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.tenants t
    where t.slug = trim(p_slug)
  );
$$;

grant execute on function public.tenant_slug_available(text) to authenticated;
