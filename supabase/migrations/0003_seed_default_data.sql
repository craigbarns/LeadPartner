-- =====================================================================
-- LeadPartner — Données par défaut et fonctions utilitaires
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fonction : provisionne un nouveau tenant complet
-- (à appeler depuis l'onboarding entreprise)
-- ---------------------------------------------------------------------

create or replace function public.create_tenant(
  p_name text,
  p_slug text,
  p_industry public.industry_code default 'other',
  p_primary_color text default '#0F172A'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_user_id uuid := auth.uid();
  v_program_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  insert into public.tenants (name, slug, industry, primary_color)
  values (p_name, p_slug, p_industry, p_primary_color)
  returning id into v_tenant_id;

  insert into public.tenant_members (tenant_id, user_id, role, status)
  values (v_tenant_id, v_user_id, 'company_admin', 'active');

  insert into public.programs (tenant_id, name, slug, description)
  values (
    v_tenant_id,
    'Programme apporteurs',
    'default',
    'Programme par défaut. Configurez-le dans Paramètres > Programme.'
  )
  returning id into v_program_id;

  insert into public.commission_rules (tenant_id, name, type, base, percentage, is_default)
  values (v_tenant_id, 'Commission par défaut', 'percentage', 'contract_amount', 5, true);

  insert into public.subscriptions (tenant_id, plan, status)
  values (v_tenant_id, 'starter', 'trialing');

  perform public.seed_industry_fields(v_tenant_id, p_industry);

  return v_tenant_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Fonction : seed des champs par secteur d'activité
-- ---------------------------------------------------------------------

create or replace function public.seed_industry_fields(
  p_tenant_id uuid,
  p_industry public.industry_code
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_industry = 'real_estate' then
    insert into public.opportunity_fields (tenant_id, industry, key, label, type, options, required, sort_order) values
      (p_tenant_id, 'real_estate', 'property_type', 'Type de bien', 'select', '["Appartement","Maison","Terrain","Local commercial","Immeuble"]'::jsonb, true, 1),
      (p_tenant_id, 'real_estate', 'transaction_type', 'Type de transaction', 'select', '["Vente","Location","Viager"]'::jsonb, true, 2),
      (p_tenant_id, 'real_estate', 'surface_m2', 'Surface (m²)', 'number', '[]'::jsonb, false, 3),
      (p_tenant_id, 'real_estate', 'rooms', 'Nombre de pièces', 'number', '[]'::jsonb, false, 4)
    on conflict (tenant_id, key) do nothing;
  elsif p_industry = 'construction' then
    insert into public.opportunity_fields (tenant_id, industry, key, label, type, options, required, sort_order) values
      (p_tenant_id, 'construction', 'work_type', 'Type de travaux', 'select', '["Rénovation","Construction neuve","Extension","Aménagement"]'::jsonb, true, 1),
      (p_tenant_id, 'construction', 'budget', 'Budget estimé', 'number', '[]'::jsonb, false, 2),
      (p_tenant_id, 'construction', 'start_date', 'Date de démarrage souhaitée', 'date', '[]'::jsonb, false, 3)
    on conflict (tenant_id, key) do nothing;
  elsif p_industry = 'insurance' then
    insert into public.opportunity_fields (tenant_id, industry, key, label, type, options, required, sort_order) values
      (p_tenant_id, 'insurance', 'insurance_type', 'Type d''assurance', 'select', '["Auto","Habitation","Santé","Pro","Vie"]'::jsonb, true, 1),
      (p_tenant_id, 'insurance', 'current_provider', 'Assureur actuel', 'text', '[]'::jsonb, false, 2),
      (p_tenant_id, 'insurance', 'renewal_date', 'Date d''échéance', 'date', '[]'::jsonb, false, 3)
    on conflict (tenant_id, key) do nothing;
  elsif p_industry = 'credit' then
    insert into public.opportunity_fields (tenant_id, industry, key, label, type, options, required, sort_order) values
      (p_tenant_id, 'credit', 'credit_type', 'Type de crédit', 'select', '["Immobilier","Conso","Pro","Rachat"]'::jsonb, true, 1),
      (p_tenant_id, 'credit', 'amount', 'Montant souhaité', 'number', '[]'::jsonb, true, 2),
      (p_tenant_id, 'credit', 'duration_years', 'Durée (années)', 'number', '[]'::jsonb, false, 3)
    on conflict (tenant_id, key) do nothing;
  elsif p_industry = 'automotive' then
    insert into public.opportunity_fields (tenant_id, industry, key, label, type, options, required, sort_order) values
      (p_tenant_id, 'automotive', 'vehicle_type', 'Type de véhicule', 'select', '["Neuf","Occasion","Utilitaire"]'::jsonb, true, 1),
      (p_tenant_id, 'automotive', 'brand', 'Marque souhaitée', 'text', '[]'::jsonb, false, 2),
      (p_tenant_id, 'automotive', 'budget', 'Budget', 'number', '[]'::jsonb, false, 3)
    on conflict (tenant_id, key) do nothing;
  elsif p_industry = 'training' then
    insert into public.opportunity_fields (tenant_id, industry, key, label, type, options, required, sort_order) values
      (p_tenant_id, 'training', 'training_topic', 'Sujet de formation', 'text', '[]'::jsonb, true, 1),
      (p_tenant_id, 'training', 'audience_size', 'Nombre de participants', 'number', '[]'::jsonb, false, 2),
      (p_tenant_id, 'training', 'funding', 'Mode de financement', 'select', '["CPF","OPCO","Personnel","Entreprise"]'::jsonb, false, 3)
    on conflict (tenant_id, key) do nothing;
  elsif p_industry = 'b2b_services' then
    insert into public.opportunity_fields (tenant_id, industry, key, label, type, options, required, sort_order) values
      (p_tenant_id, 'b2b_services', 'company_size', 'Taille de l''entreprise', 'select', '["1-10","11-50","51-200","201-500","500+"]'::jsonb, false, 1),
      (p_tenant_id, 'b2b_services', 'service_needed', 'Service recherché', 'text', '[]'::jsonb, true, 2),
      (p_tenant_id, 'b2b_services', 'decision_timeline', 'Échéance de décision', 'select', '["Immédiat","< 1 mois","1-3 mois","> 3 mois"]'::jsonb, false, 3)
    on conflict (tenant_id, key) do nothing;
  end if;
end;
$$;

grant execute on function public.create_tenant(text, text, public.industry_code, text) to authenticated;
grant execute on function public.seed_industry_fields(uuid, public.industry_code) to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_member_of(uuid) to authenticated;
grant execute on function public.is_admin_of(uuid) to authenticated;
grant execute on function public.is_collaborator_of(uuid) to authenticated;
grant execute on function public.is_referrer_of(uuid) to authenticated;
