-- =====================================================================
-- Private buckets for contract PDFs
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('contracts-signed', 'contracts-signed', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('contracts-unsigned', 'contracts-unsigned', false)
on conflict (id) do nothing;

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
