-- =============================================================================
-- Go Unplugged — Row Level Security
-- Regla general:
--   * Cada usuario ve y edita lo suyo.
--   * Un socio activo puede VER los datos de quien supervisa y EDITAR sus reglas.
--   * Las operaciones sensibles (invitar, aceptar, pedir, decidir, revocar)
--     solo se hacen vía funciones RPC (ver 20261104210126_functions.sql).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers (security definer para evitar recursión de RLS en partnerships)
-- -----------------------------------------------------------------------------
create or replace function public.is_partner_of(p_monitored uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.partnerships
    where monitored_id = p_monitored
      and partner_id = (select auth.uid())
      and status in ('active', 'revoking')
  );
$$;

create or replace function public.has_active_partner(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.partnerships
    where monitored_id = p_user and status in ('active', 'revoking')
  );
$$;

-- ¿Comparten alguna relación (en cualquier dirección)?
create or replace function public.is_connected_to(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.partnerships
    where status in ('active', 'revoking')
      and (
        (monitored_id = p_other and partner_id = (select auth.uid()))
        or (partner_id = p_other and monitored_id = (select auth.uid()))
      )
  );
$$;

revoke all on function public.is_partner_of(uuid), public.has_active_partner(uuid), public.is_connected_to(uuid) from public, anon;
grant execute on function public.is_partner_of(uuid), public.has_active_partner(uuid), public.is_connected_to(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Activar RLS
-- -----------------------------------------------------------------------------
alter table public.plans               enable row level security;
alter table public.profiles            enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.devices             enable row level security;
alter table public.partner_invitations enable row level security;
alter table public.partnerships        enable row level security;
alter table public.limit_rules         enable row level security;
alter table public.rule_targets        enable row level security;
alter table public.extension_requests  enable row level security;
alter table public.usage_daily         enable row level security;
alter table public.device_events       enable row level security;
alter table public.notifications       enable row level security;

-- -----------------------------------------------------------------------------
-- Grants explícitos (la seguridad real la dan las políticas)
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.plans to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.subscriptions to authenticated;
grant select, insert, update, delete on public.devices to authenticated;
grant select, update on public.partner_invitations to authenticated;
grant select on public.partnerships to authenticated;
grant select, insert, update, delete on public.limit_rules to authenticated;
grant select, insert, delete on public.rule_targets to authenticated;
grant select on public.extension_requests to authenticated;
grant select on public.active_grants to authenticated;
grant select, insert, update on public.usage_daily to authenticated;
grant select, insert on public.device_events to authenticated;
grant select, update on public.notifications to authenticated;

-- -----------------------------------------------------------------------------
-- plans
-- -----------------------------------------------------------------------------
create policy "plans: lectura pública" on public.plans
  for select to anon, authenticated using (is_public);

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy "profiles: ver el propio y los conectados" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_connected_to(id));

create policy "profiles: editar el propio" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- subscriptions (solo lectura del propio; escribe service_role)
-- -----------------------------------------------------------------------------
create policy "subscriptions: ver la propia" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- devices
-- -----------------------------------------------------------------------------
create policy "devices: ver propios o supervisados" on public.devices
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_partner_of(user_id));

create policy "devices: registrar propios" on public.devices
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "devices: actualizar propios" on public.devices
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "devices: borrar propios" on public.devices
  for delete to authenticated using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- partner_invitations (crear/aceptar vía RPC; aquí solo ver y revocar)
-- -----------------------------------------------------------------------------
create policy "invitations: ver las propias" on public.partner_invitations
  for select to authenticated
  using (inviter_id = (select auth.uid()) or accepted_by = (select auth.uid()));

create policy "invitations: revocar las propias" on public.partner_invitations
  for update to authenticated
  using (inviter_id = (select auth.uid()) and status = 'pending')
  with check (inviter_id = (select auth.uid()) and status in ('pending', 'revoked'));

-- -----------------------------------------------------------------------------
-- partnerships (solo lectura; cambios vía RPC)
-- -----------------------------------------------------------------------------
create policy "partnerships: ver las propias" on public.partnerships
  for select to authenticated
  using (monitored_id = (select auth.uid()) or partner_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- limit_rules — el dueño y sus socios. Relajar una regla propia teniendo
-- socio se bloquea con un trigger (ver functions.sql) y se pide como
-- extension_requests.kind = 'rule_relax'.
-- -----------------------------------------------------------------------------
create policy "rules: ver propias o supervisadas" on public.limit_rules
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_partner_of(user_id));

create policy "rules: crear propias o supervisadas" on public.limit_rules
  for insert to authenticated
  with check (user_id = (select auth.uid()) or public.is_partner_of(user_id));

create policy "rules: editar propias o supervisadas" on public.limit_rules
  for update to authenticated
  using (user_id = (select auth.uid()) or public.is_partner_of(user_id))
  with check (user_id = (select auth.uid()) or public.is_partner_of(user_id));

create policy "rules: borrar propias o supervisadas" on public.limit_rules
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_partner_of(user_id));

-- -----------------------------------------------------------------------------
-- rule_targets
-- -----------------------------------------------------------------------------
create policy "targets: ver propios o supervisados" on public.rule_targets
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_partner_of(user_id));

create policy "targets: agregar propios o supervisados" on public.rule_targets
  for insert to authenticated
  with check (
    (user_id = (select auth.uid()) or public.is_partner_of(user_id))
    and exists (select 1 from public.limit_rules r where r.id = rule_id and r.user_id = rule_targets.user_id)
  );

create policy "targets: quitar propios o supervisados" on public.rule_targets
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_partner_of(user_id));

-- -----------------------------------------------------------------------------
-- extension_requests (crear/decidir vía RPC)
-- -----------------------------------------------------------------------------
create policy "requests: ver propias o de supervisados" on public.extension_requests
  for select to authenticated
  using (requester_id = (select auth.uid()) or public.is_partner_of(requester_id));

-- -----------------------------------------------------------------------------
-- usage_daily
-- -----------------------------------------------------------------------------
create policy "usage: ver propio o supervisado" on public.usage_daily
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_partner_of(user_id));

create policy "usage: reportar propio" on public.usage_daily
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.devices d where d.id = device_id and d.user_id = (select auth.uid()))
  );

create policy "usage: actualizar propio" on public.usage_daily
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- device_events
-- -----------------------------------------------------------------------------
create policy "events: ver propios o supervisados" on public.device_events
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_partner_of(user_id));

create policy "events: reportar propios" on public.device_events
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and type not in ('pin_verified', 'pin_failed') -- esos solo los escribe verify_partner_pin
  );

-- -----------------------------------------------------------------------------
-- notifications
-- -----------------------------------------------------------------------------
create policy "notifications: ver las propias" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

create policy "notifications: marcar como leídas" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Solo se permite cambiar read_at desde el cliente.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Perfil: el cliente no puede tocar id ni timestamps.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url, timezone, locale, onboarding_completed,
              emergency_unlocks_per_month, emergency_unlock_minutes)
  on public.profiles to authenticated;

-- Invitaciones: el cliente solo puede cambiar el estado (a 'revoked').
revoke update on public.partner_invitations from authenticated;
grant update (status) on public.partner_invitations to authenticated;
