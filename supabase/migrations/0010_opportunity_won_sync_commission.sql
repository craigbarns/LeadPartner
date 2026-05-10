-- Crée ou met à jour une ligne `commissions` quand une opportunité passe en « gagnée »
-- (sale_closed / commission_due / commission_paid), d’après la règle par défaut du tenant.
-- Ne modifie pas les commissions déjà « due », « validated » ou « paid ».

create or replace function public.sync_commission_on_opportunity_won()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.commission_rules%rowtype;
  v_base numeric(14, 2);
  v_amount numeric(14, 2);
  v_pct numeric(7, 4);
  v_comm_id uuid;
  v_comm_status public.commission_status;
begin
  if new.referrer_id is null then
    return new;
  end if;

  if new.status not in ('sale_closed', 'commission_due', 'commission_paid') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status is not distinct from new.status
       and old.closed_value is not distinct from new.closed_value
       and old.estimated_value is not distinct from new.estimated_value
       and old.referrer_id is not distinct from new.referrer_id then
      return new;
    end if;
  end if;

  select * into v_rule
  from public.commission_rules
  where tenant_id = new.tenant_id and is_default = true
  order by created_at asc
  limit 1;

  if not found then
    return new;
  end if;

  v_base := coalesce(new.closed_value, new.estimated_value, 0);

  if v_rule.type = 'percentage' and v_rule.percentage is not null then
    v_amount := round(v_base * (v_rule.percentage / 100.0), 2);
  elsif v_rule.type = 'fixed' and v_rule.fixed_amount is not null then
    v_amount := v_rule.fixed_amount;
  elsif v_rule.type = 'tiered' and coalesce(v_rule.tiers, '[]'::jsonb) <> '[]'::jsonb then
    select (t.elem->>'percentage')::numeric into v_pct
    from jsonb_array_elements(coalesce(v_rule.tiers, '[]'::jsonb)) as t(elem)
    where (t.elem->>'min')::numeric <= v_base
    order by (t.elem->>'min')::numeric desc
    limit 1;
    if v_pct is null then
      v_amount := 0;
    else
      v_amount := round(v_base * (v_pct / 100.0), 2);
    end if;
  else
    v_amount := 0;
  end if;

  select c.id, c.status into v_comm_id, v_comm_status
  from public.commissions c
  where c.opportunity_id = new.id
  limit 1;

  if v_comm_id is not null then
    if v_comm_status not in ('estimated', 'canceled') then
      return new;
    end if;
    update public.commissions
    set
      amount = v_amount,
      base_amount = v_base,
      rule_id = v_rule.id,
      referrer_id = new.referrer_id,
      updated_at = now()
    where id = v_comm_id;
  else
    insert into public.commissions (
      tenant_id, opportunity_id, referrer_id, rule_id, status, amount, base_amount
    )
    values (
      new.tenant_id,
      new.id,
      new.referrer_id,
      v_rule.id,
      'estimated',
      v_amount,
      v_base
    );
  end if;

  return new;
end;
$$;

drop trigger if exists opportunities_commission_sync on public.opportunities;

create trigger opportunities_commission_sync
  after insert or update of status, closed_value, estimated_value, referrer_id
  on public.opportunities
  for each row
  execute function public.sync_commission_on_opportunity_won();
