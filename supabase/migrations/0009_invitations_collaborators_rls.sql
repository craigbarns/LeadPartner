-- Les collaborateurs peuvent gérer les invitations (liens) comme les admins entreprise.

drop policy if exists "invitations_admin_all" on public.invitations;

create policy "invitations_staff_all"
  on public.invitations for all
  using (public.is_collaborator_of(tenant_id))
  with check (public.is_collaborator_of(tenant_id));
