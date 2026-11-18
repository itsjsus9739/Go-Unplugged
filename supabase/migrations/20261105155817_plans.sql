-- =============================================================================
-- Go Unplugged — Diferencias por plan de suscripción
-- -----------------------------------------------------------------------------
-- Precios ILUSTRATIVOS (definidos en la landing): Individual 4.99, Pareja 7.99,
-- Familiar 12.99 USD/mes. Los beneficios se aplican en la base de datos.
--
--  * Gratis: 1 socio, hasta 3 apps limitadas, historial de 7 días.
--  * Individual: apps ilimitadas, historial completo.
--  * Pareja / Familiar: además CUBREN a las personas que el titular acompaña
--    (control cruzado / socio administrador), reportes semanales y panel familiar.
--  * Prueba gratis de 7 días (una por usuario) mientras no hay pagos integrados.
-- =============================================================================

alter table public.plans
  add column max_apps        int     check (max_apps is null or max_apps > 0),     -- null = ilimitadas
  add column history_days    int     check (history_days is null or history_days > 0), -- null = completo
  add column weekly_reports  boolean not null default false,
  add column family_panel    boolean not null default false,
  add column covers_partners boolean not null default false; -- el plan cubre a quienes el titular acompaña

update public.plans set max_apps = 3, history_days = 7,
  features = '["1 socio de confianza","Hasta 3 apps limitadas","Historial de 7 días"]'
  where tier = 'free';
update public.plans set
  features = '["1 usuario monitoreado","Apps ilimitadas","Historial de peticiones completo"]'
  where tier = 'individual';
update public.plans set weekly_reports = true, covers_partners = true,
  features = '["2 usuarios monitoreados","Control cruzado entre ambos","Apps ilimitadas","Reportes semanales","Soporte prioritario"]'
  where tier = 'pareja';
update public.plans set weekly_reports = true, family_panel = true, covers_partners = true,
  features = '["Hasta 6 usuarios monitoreados","Un socio administrador central","Apps ilimitadas","Panel familiar compartido"]'
  where tier = 'familiar';

-- Plan que rige para un usuario: el suyo o el de un socio que lo acompaña con
-- un plan que cubre (Pareja/Familiar). Se toma el mayor.
create or replace function public.plan_tier_for(p_user uuid)
returns public.plan_tier
language sql
stable
security definer
set search_path = ''
as $$
  select max(t) from (
    select public.effective_tier(p_user) as t
    union all
    select pt.tier
    from public.partnerships p
    cross join lateral (select public.effective_tier(p.partner_id) as tier) pt
    join public.plans pl on pl.tier = pt.tier
    where p.monitored_id = p_user and p.status in ('active', 'revoking') and pl.covers_partners
  ) x;
$$;

-- Tope de apps limitadas según el plan (cuenta identificadores distintos del usuario).
create or replace function public.enforce_plan_app_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max int;
begin
  select max_apps into v_max from public.plans where tier = public.plan_tier_for(new.user_id);
  if v_max is not null and (
       select count(distinct identifier) from public.rule_targets
       where user_id = new.user_id and identifier <> new.identifier
     ) >= v_max then
    raise exception 'plan_app_limit' using hint = format('El plan permite %s apps.', v_max);
  end if;
  return new;
end;
$$;

create trigger rule_targets_plan_limit
  before insert on public.rule_targets
  for each row execute function public.enforce_plan_app_limit();

-- Resumen del plan del usuario actual (para la app).
create or replace function public.my_plan()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := public.require_uid();
  v_tier public.plan_tier := public.plan_tier_for(v_uid);
  v_own  public.plan_tier := public.effective_tier(v_uid);
  v_sub  public.subscriptions;
begin
  select * into v_sub from public.subscriptions
  where user_id = v_uid and status in ('trialing', 'active', 'past_due')
  limit 1;

  return jsonb_build_object(
    'tier', v_tier,
    'own_tier', v_own,
    'source', case when v_tier = 'free' then 'free'
                   when v_tier = v_own then coalesce(case when v_sub.provider = 'trial' then 'trial' end, 'own')
                   else 'partner' end,
    'status', v_sub.status,
    'provider', v_sub.provider,
    'current_period_end', v_sub.current_period_end,
    'trial_available', not exists (select 1 from public.subscriptions where user_id = v_uid),
    'apps_used', (select count(distinct identifier) from public.rule_targets where user_id = v_uid),
    'plan', (select to_jsonb(p) from public.plans p where p.tier = v_tier)
  );
end;
$$;

-- Prueba gratis de 7 días (una sola vez por usuario).
create or replace function public.start_trial(p_tier public.plan_tier)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
begin
  if p_tier = 'free' then
    raise exception 'invalid_plan';
  end if;
  if exists (select 1 from public.subscriptions where user_id = v_uid) then
    raise exception 'trial_already_used';
  end if;

  insert into public.subscriptions (user_id, tier, status, provider, current_period_end)
  values (v_uid, p_tier, 'trialing', 'trial', now() + interval '7 days');

  return public.my_plan();
end;
$$;

-- Mantenimiento: también vence las pruebas gratis.
create or replace function public.run_maintenance()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.extension_requests
     set status = 'expired'
   where status = 'pending' and expires_at < now();

  update public.partner_invitations
     set status = 'expired'
   where status = 'pending' and expires_at < now();

  update public.subscriptions
     set status = 'expired'
   where provider = 'trial' and status = 'trialing' and current_period_end < now();

  with done as (
    update public.partnerships
       set status = 'revoked', revoked_at = now()
     where status = 'revoking' and revoke_effective_at <= now()
    returning id, partner_id, monitored_id
  )
  insert into public.notifications (user_id, type, title, body, data)
  select partner_id, 'partnership_revoked', 'El acuerdo terminó',
         public.display_name_of(monitored_id) || ' ya no está bajo tu supervisión.',
         jsonb_build_object('partnership_id', id)
  from done;
end;
$$;

revoke all on function public.plan_tier_for(uuid), public.enforce_plan_app_limit(), public.run_maintenance()
  from public, anon, authenticated;
grant execute on function public.run_maintenance() to service_role;

revoke all on function public.my_plan(), public.start_trial(public.plan_tier) from public, anon;
grant execute on function public.my_plan(), public.start_trial(public.plan_tier) to authenticated;
