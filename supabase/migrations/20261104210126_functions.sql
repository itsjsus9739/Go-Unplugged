-- =============================================================================
-- Go Unplugged — Lógica de negocio (RPC + triggers)
-- -----------------------------------------------------------------------------
-- Traducción a base de datos del prototipo:
--   GoUnplugged.intentar_acceso()          -> request_extension()
--   SocioResponsabilidad.aprobar_desbloqueo -> decide_request()
--   GoUnplugged.sincronizar_autorizacion() -> el dispositivo lee active_grants
--                                             (en tiempo real vía Supabase Realtime)
-- Los errores se lanzan con mensajes en snake_case para que la app los traduzca.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Internos
-- -----------------------------------------------------------------------------
create or replace function public.require_uid()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return v_uid;
end;
$$;

create or replace function public.notify(
  p_user uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, data)
  values (p_user, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb));
$$;

create or replace function public.notify_partners(
  p_monitored uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, data)
  select p.partner_id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb)
  from public.partnerships p
  where p.monitored_id = p_monitored and p.status in ('active', 'revoking');
$$;

create or replace function public.display_name_of(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(display_name, ''), 'Tu socio') from public.profiles where id = p_user;
$$;

create or replace function public.effective_tier(p_user uuid)
returns public.plan_tier
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.tier from public.subscriptions s
      where s.user_id = p_user and s.status in ('trialing', 'active', 'past_due')
      limit 1),
    'free'::public.plan_tier
  );
$$;

create or replace function public.generate_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  -- 8 caracteres sin ambiguos (sin 0/O, 1/I)
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (get_byte(extensions.gen_random_bytes(1), 0) % 32) + 1, 1),
    ''
  )
  from generate_series(1, 8);
$$;

-- -----------------------------------------------------------------------------
-- Guardas: con socio activo, el propio usuario solo puede ENDURECER sus límites.
-- Relajar => extension_requests.kind = 'rule_relax'. El socio sí puede editar.
-- -----------------------------------------------------------------------------
create or replace function public.guard_rule_relax()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_relaxes boolean := false;
begin
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'rule_owner_immutable';
  end if;

  -- Contexto de servicio (sin JWT) o editado por un socio: permitido.
  if v_uid is null or v_uid <> old.user_id or not public.has_active_partner(old.user_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    v_relaxes := true;
  else
    v_relaxes :=
         new.daily_limit_minutes > old.daily_limit_minutes
      or (old.is_active and not new.is_active)
      or not (old.active_days <@ new.active_days)
      or (old.block_start is not null and (
            new.block_start is distinct from old.block_start
         or new.block_end   is distinct from old.block_end));
  end if;

  if v_relaxes then
    raise exception 'rule_relax_requires_partner'
      using hint = 'Crea una petición con kind = rule_relax para que tu socio la apruebe.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger limit_rules_guard_relax
  before update or delete on public.limit_rules
  for each row execute function public.guard_rule_relax();

create or replace function public.guard_target_removal()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is not null and v_uid = old.user_id and public.has_active_partner(old.user_id) then
    raise exception 'rule_relax_requires_partner';
  end if;
  return old;
end;
$$;

create trigger rule_targets_guard_removal
  before delete on public.rule_targets
  for each row execute function public.guard_target_removal();

create or replace function public.guard_profile_relax()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is not null and v_uid = old.id and public.has_active_partner(old.id) and (
       new.emergency_unlocks_per_month > old.emergency_unlocks_per_month
    or new.emergency_unlock_minutes    > old.emergency_unlock_minutes
  ) then
    raise exception 'rule_relax_requires_partner';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_relax
  before update on public.profiles
  for each row execute function public.guard_profile_relax();

-- -----------------------------------------------------------------------------
-- Invitaciones
-- -----------------------------------------------------------------------------
create or replace function public.create_invitation(
  p_inviter_role public.invitation_role default 'monitored'
)
returns public.partner_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_inv public.partner_invitations;
begin
  if (select count(*) from public.partner_invitations
      where inviter_id = v_uid and status = 'pending' and expires_at > now()) >= 5 then
    raise exception 'too_many_pending_invitations';
  end if;

  loop
    begin
      insert into public.partner_invitations (inviter_id, inviter_role, code)
      values (v_uid, p_inviter_role, public.generate_invite_code())
      returning * into v_inv;
      exit;
    exception when unique_violation then
      -- colisión de código: reintentar
    end;
  end loop;

  return v_inv;
end;
$$;

create or replace function public.accept_invitation(p_code text)
returns public.partnerships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := public.require_uid();
  v_inv       public.partner_invitations;
  v_monitored uuid;
  v_partner   uuid;
  v_ps        public.partnerships;
begin
  select * into v_inv from public.partner_invitations
  where code = upper(trim(p_code))
  for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'invitation_not_pending';
  end if;
  if v_inv.expires_at < now() then
    update public.partner_invitations set status = 'expired' where id = v_inv.id;
    raise exception 'invitation_expired';
  end if;
  if v_inv.inviter_id = v_uid then
    raise exception 'cannot_accept_own_invitation';
  end if;

  if v_inv.inviter_role = 'monitored' then
    v_monitored := v_inv.inviter_id;  v_partner := v_uid;
  else
    v_monitored := v_uid;             v_partner := v_inv.inviter_id;
  end if;

  if exists (select 1 from public.partnerships
             where monitored_id = v_monitored and partner_id = v_partner and status <> 'revoked') then
    raise exception 'already_partners';
  end if;

  -- Límites del plan (valores ilustrativos en public.plans)
  if (select count(*) from public.partnerships where partner_id = v_partner and status <> 'revoked')
     >= (select max_monitored from public.plans where tier = public.effective_tier(v_partner)) then
    raise exception 'partner_plan_limit';
  end if;
  if (select count(*) from public.partnerships where monitored_id = v_monitored and status <> 'revoked')
     >= (select max_partners from public.plans where tier = public.effective_tier(v_monitored)) then
    raise exception 'monitored_plan_limit';
  end if;

  insert into public.partnerships (monitored_id, partner_id, invitation_id)
  values (v_monitored, v_partner, v_inv.id)
  returning * into v_ps;

  update public.partner_invitations
     set status = 'accepted', accepted_by = v_uid, accepted_at = now()
   where id = v_inv.id;

  perform public.notify(
    v_inv.inviter_id, 'partner_joined',
    'Tu acuerdo está activo',
    public.display_name_of(v_uid) || ' aceptó tu invitación.',
    jsonb_build_object('partnership_id', v_ps.id)
  );

  return v_ps;
end;
$$;

-- -----------------------------------------------------------------------------
-- Relaciones
-- -----------------------------------------------------------------------------
create or replace function public.revoke_partnership(p_partnership_id uuid)
returns public.partnerships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_ps  public.partnerships;
begin
  select * into v_ps from public.partnerships where id = p_partnership_id for update;
  if not found or v_uid not in (v_ps.monitored_id, v_ps.partner_id) or v_ps.status = 'revoked' then
    raise exception 'partnership_not_found';
  end if;

  if v_uid = v_ps.partner_id then
    -- El socio puede soltar el control de inmediato.
    update public.partnerships
       set status = 'revoked', revoked_by = v_uid, revoked_at = now()
     where id = v_ps.id
    returning * into v_ps;

    perform public.notify(v_ps.monitored_id, 'partnership_revoked',
      'Tu socio terminó el acuerdo',
      public.display_name_of(v_uid) || ' ya no supervisa tus límites.',
      jsonb_build_object('partnership_id', v_ps.id));
  elsif v_ps.status = 'active' then
    -- El monitoreado: periodo de enfriamiento de 24 h, avisando al socio.
    update public.partnerships
       set status = 'revoking', revoke_requested_at = now(),
           revoke_effective_at = now() + interval '24 hours', revoked_by = v_uid
     where id = v_ps.id
    returning * into v_ps;

    perform public.notify(v_ps.partner_id, 'partnership_revoking',
      'Quieren terminar el acuerdo',
      public.display_name_of(v_uid) || ' pidió terminar el acuerdo. Se hará efectivo en 24 h.',
      jsonb_build_object('partnership_id', v_ps.id));
  end if;

  return v_ps;
end;
$$;

-- PIN que el socio entrega en persona (urgencias, desinstalar, apagar protección).
create or replace function public.set_partner_pin(p_partnership_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
begin
  if p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'invalid_pin';
  end if;

  update public.partnerships
     set partner_pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
   where id = p_partnership_id and partner_id = v_uid and status = 'active';

  if not found then
    raise exception 'partnership_not_found';
  end if;
end;
$$;

create or replace function public.verify_partner_pin(p_pin text, p_device_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_ok  boolean;
begin
  if (select count(*) from public.device_events
      where user_id = v_uid and type = 'pin_failed' and created_at > now() - interval '15 minutes') >= 5 then
    raise exception 'too_many_attempts';
  end if;

  select exists (
    select 1 from public.partnerships
    where monitored_id = v_uid and status in ('active', 'revoking')
      and partner_pin_hash is not null
      and partner_pin_hash = extensions.crypt(p_pin, partner_pin_hash)
  ) into v_ok;

  insert into public.device_events (user_id, device_id, type)
  values (v_uid, p_device_id, case when v_ok then 'pin_verified' else 'pin_failed' end::public.device_event_type);

  if v_ok then
    perform public.notify_partners(v_uid, 'pin_used',
      'Se usó tu PIN',
      public.display_name_of(v_uid) || ' desbloqueó su teléfono con tu PIN.',
      jsonb_build_object('device_id', p_device_id));
  end if;

  return v_ok;
end;
$$;

-- -----------------------------------------------------------------------------
-- Peticiones
-- -----------------------------------------------------------------------------
create or replace function public.request_extension(
  p_kind              public.request_kind default 'time_extension',
  p_minutes           int     default null,
  p_reason            text    default null,
  p_rule_id           uuid    default null,
  p_target_identifier text    default null,
  p_target_name       text    default null,
  p_device_id         uuid    default null,
  p_payload           jsonb   default '{}'::jsonb
)
returns public.extension_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := public.require_uid();
  v_profile public.profiles;
  v_req     public.extension_requests;
  v_used    int;
  v_name    text;
begin
  if not public.has_active_partner(v_uid) then
    raise exception 'no_active_partner';
  end if;
  if p_rule_id is not null and not exists (
       select 1 from public.limit_rules where id = p_rule_id and user_id = v_uid) then
    raise exception 'rule_not_found';
  end if;
  if p_device_id is not null and not exists (
       select 1 from public.devices where id = p_device_id and user_id = v_uid) then
    raise exception 'device_not_found';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  v_name := public.display_name_of(v_uid);

  -- Urgencia: autoaprobada con cupo mensual; el socio se entera igual.
  if p_kind = 'emergency' then
    select count(*) into v_used from public.extension_requests
    where requester_id = v_uid and kind = 'emergency'
      and created_at >= date_trunc('month', now() at time zone v_profile.timezone) at time zone v_profile.timezone;

    if v_used >= v_profile.emergency_unlocks_per_month then
      raise exception 'emergency_quota_exhausted';
    end if;

    insert into public.extension_requests (
      requester_id, device_id, rule_id, kind, target_identifier, target_name,
      minutes_requested, reason, status, decided_at, minutes_granted, grant_starts_at, grant_ends_at)
    values (
      v_uid, p_device_id, p_rule_id, 'emergency', p_target_identifier, p_target_name,
      v_profile.emergency_unlock_minutes, p_reason, 'approved', now(), v_profile.emergency_unlock_minutes,
      now(), now() + make_interval(mins => v_profile.emergency_unlock_minutes))
    returning * into v_req;

    perform public.notify_partners(v_uid, 'emergency_used',
      v_name || ' usó un desbloqueo de urgencia',
      coalesce(p_target_name, 'Todas las apps') || ' · ' || v_profile.emergency_unlock_minutes || ' min'
        || coalesce(' · "' || p_reason || '"', ''),
      jsonb_build_object('request_id', v_req.id));
    return v_req;
  end if;

  if p_kind = 'rule_relax' then
    if p_rule_id is null then
      raise exception 'rule_required';
    end if;
    if exists (select 1 from jsonb_object_keys(coalesce(p_payload, '{}'::jsonb)) k
               where k not in ('daily_limit_minutes', 'is_active', 'active_days',
                               'block_start', 'block_end', 'remove_target_ids', 'delete_rule')) then
      raise exception 'invalid_payload';
    end if;
  end if;

  if p_kind = 'time_extension' and p_minutes is null then
    raise exception 'minutes_required';
  end if;

  -- Evita spam: si ya hay una petición pendiente equivalente, se devuelve esa.
  select * into v_req from public.extension_requests
  where requester_id = v_uid and status = 'pending' and expires_at > now()
    and kind = p_kind
    and rule_id is not distinct from p_rule_id
    and target_identifier is not distinct from p_target_identifier
  limit 1;
  if found then
    return v_req;
  end if;

  insert into public.extension_requests (
    requester_id, device_id, rule_id, kind, target_identifier, target_name,
    minutes_requested, reason, payload)
  values (
    v_uid, p_device_id, p_rule_id, p_kind, p_target_identifier, p_target_name,
    p_minutes, p_reason, coalesce(p_payload, '{}'::jsonb))
  returning * into v_req;

  perform public.notify_partners(v_uid, 'request_created',
    case p_kind
      when 'time_extension'     then v_name || ' pide ' || p_minutes || ' min extra'
      when 'rule_relax'         then v_name || ' quiere cambiar un límite'
      when 'disable_protection' then v_name || ' quiere desactivar la protección'
    end,
    coalesce(p_target_name, 'Petición de tiempo') || coalesce(' · "' || p_reason || '"', ''),
    jsonb_build_object('request_id', v_req.id));

  return v_req;
end;
$$;

create or replace function public.decide_request(
  p_request_id      uuid,
  p_approve         boolean,
  p_minutes_granted int  default null,
  p_note            text default null
)
returns public.extension_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := public.require_uid();
  v_req     public.extension_requests;
  v_minutes int;
  v_payload jsonb;
begin
  select * into v_req from public.extension_requests where id = p_request_id for update;

  -- Mismo error si no existe o si no eres su socio (no filtrar existencia).
  if not found or not public.is_partner_of(v_req.requester_id) then
    raise exception 'request_not_found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'request_not_pending';
  end if;
  if v_req.expires_at < now() then
    update public.extension_requests set status = 'expired' where id = v_req.id;
    raise exception 'request_expired';
  end if;

  if not p_approve then
    update public.extension_requests
       set status = 'denied', decided_by = v_uid, decided_at = now(), decision_note = p_note
     where id = v_req.id
    returning * into v_req;

    perform public.notify(v_req.requester_id, 'request_decided',
      'Límite mantenido',
      public.display_name_of(v_uid) || ' no aprobó tu petición.' || coalesce(' "' || p_note || '"', ''),
      jsonb_build_object('request_id', v_req.id, 'approved', false));
    return v_req;
  end if;

  if v_req.kind = 'rule_relax' then
    v_payload := v_req.payload;

    if coalesce((v_payload ->> 'delete_rule')::boolean, false) then
      delete from public.limit_rules where id = v_req.rule_id;
    else
      update public.limit_rules set
        daily_limit_minutes = coalesce((v_payload ->> 'daily_limit_minutes')::int, daily_limit_minutes),
        is_active           = coalesce((v_payload ->> 'is_active')::boolean, is_active),
        active_days         = coalesce(
                                (select array_agg(d::smallint) from jsonb_array_elements_text(v_payload -> 'active_days') d),
                                active_days),
        block_start         = case when v_payload ? 'block_start' then (v_payload ->> 'block_start')::time else block_start end,
        block_end           = case when v_payload ? 'block_end'   then (v_payload ->> 'block_end')::time   else block_end   end,
        updated_by          = v_uid
      where id = v_req.rule_id;

      if v_payload ? 'remove_target_ids' then
        delete from public.rule_targets
        where rule_id = v_req.rule_id
          and id in (select (t)::uuid from jsonb_array_elements_text(v_payload -> 'remove_target_ids') t);
      end if;
    end if;

    update public.extension_requests
       set status = 'approved', decided_by = v_uid, decided_at = now(), decision_note = p_note
     where id = v_req.id
    returning * into v_req;
  else
    v_minutes := coalesce(p_minutes_granted, v_req.minutes_requested, 60);
    update public.extension_requests
       set status = 'approved', decided_by = v_uid, decided_at = now(), decision_note = p_note,
           minutes_granted = v_minutes,
           grant_starts_at = now(),
           grant_ends_at   = now() + make_interval(mins => v_minutes)
     where id = v_req.id
    returning * into v_req;
  end if;

  perform public.notify(v_req.requester_id, 'request_decided',
    'Petición aprobada',
    public.display_name_of(v_uid) || ' aprobó tu petición'
      || coalesce(' · ' || v_req.minutes_granted || ' min', '') || '.',
    jsonb_build_object('request_id', v_req.id, 'approved', true));

  return v_req;
end;
$$;

create or replace function public.cancel_request(p_request_id uuid)
returns public.extension_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_req public.extension_requests;
begin
  update public.extension_requests
     set status = 'cancelled'
   where id = p_request_id and requester_id = v_uid and status = 'pending'
  returning * into v_req;

  if not found then
    raise exception 'request_not_found';
  end if;
  return v_req;
end;
$$;

-- -----------------------------------------------------------------------------
-- Antimanipulación: avisar al socio de eventos sensibles del dispositivo.
-- -----------------------------------------------------------------------------
create or replace function public.on_device_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type in ('protection_disabled', 'permission_revoked', 'uninstall_attempt') then
    perform public.notify_partners(new.user_id, 'tamper_' || new.type::text,
      'Atención: ' || public.display_name_of(new.user_id),
      case new.type
        when 'protection_disabled' then 'Desactivó la protección de Go Unplugged.'
        when 'permission_revoked'  then 'Quitó un permiso necesario para el bloqueo.'
        when 'uninstall_attempt'   then 'Intentó desinstalar Go Unplugged.'
      end,
      jsonb_build_object('device_id', new.device_id, 'event_id', new.id));
  end if;
  return new;
end;
$$;

create trigger device_events_notify
  after insert on public.device_events
  for each row execute function public.on_device_event();

-- -----------------------------------------------------------------------------
-- Mantenimiento (pg_cron cada 5 min, ver migración 4). Solo service_role.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Permisos de ejecución
-- -----------------------------------------------------------------------------
revoke all on function
  public.require_uid(),
  public.notify(uuid, text, text, text, jsonb),
  public.notify_partners(uuid, text, text, text, jsonb),
  public.display_name_of(uuid),
  public.effective_tier(uuid),
  public.generate_invite_code(),
  public.run_maintenance(),
  public.handle_new_user(),
  public.on_device_event(),
  public.guard_rule_relax(),
  public.guard_target_removal(),
  public.guard_profile_relax(),
  public.set_updated_at()
from public, anon, authenticated;

revoke all on function
  public.create_invitation(public.invitation_role),
  public.accept_invitation(text),
  public.revoke_partnership(uuid),
  public.set_partner_pin(uuid, text),
  public.verify_partner_pin(text, uuid),
  public.request_extension(public.request_kind, int, text, uuid, text, text, uuid, jsonb),
  public.decide_request(uuid, boolean, int, text),
  public.cancel_request(uuid)
from public, anon;

grant execute on function
  public.create_invitation(public.invitation_role),
  public.accept_invitation(text),
  public.revoke_partnership(uuid),
  public.set_partner_pin(uuid, text),
  public.verify_partner_pin(text, uuid),
  public.request_extension(public.request_kind, int, text, uuid, text, text, uuid, jsonb),
  public.decide_request(uuid, boolean, int, text),
  public.cancel_request(uuid)
to authenticated;

grant execute on function public.run_maintenance() to service_role;
