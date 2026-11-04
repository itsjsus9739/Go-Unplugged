-- =============================================================================
-- Go Unplugged — Esquema base
-- -----------------------------------------------------------------------------
-- Modelo: un usuario "monitoreado" entrega el control de sus límites a uno o
-- más "socios de confianza". Toda extensión de tiempo (o relajación de una
-- regla) pasa por la aprobación de un socio. Referencia de comportamiento:
-- prototipo-python/gounplugged.py (SocioResponsabilidad / GoUnplugged).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.platform as enum ('android', 'ios');

create type public.plan_tier as enum ('free', 'individual', 'pareja', 'familiar');

create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'expired');

-- 'monitored': quien invita quiere que el invitado sea su socio.
-- 'partner'  : quien invita será el socio del invitado.
create type public.invitation_role as enum ('monitored', 'partner');

create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

-- 'revoking': el monitoreado pidió terminar la relación; se hace efectiva
-- tras un periodo de enfriamiento (ver revoke_partnership) para que no sea
-- un "botón secreto" para saltarse el límite.
create type public.partnership_status as enum ('active', 'revoking', 'revoked');

create type public.request_kind as enum (
  'time_extension',     -- "Instagram · 15 min extra"
  'emergency',          -- desbloqueo de urgencia (cupo mensual, autoaprobado, se notifica al socio)
  'rule_relax',         -- subir un límite / desactivar una regla / quitar una app
  'disable_protection'  -- apagar la protección del dispositivo / desinstalar
);

create type public.request_status as enum ('pending', 'approved', 'denied', 'expired', 'cancelled');

create type public.target_type as enum ('app', 'category', 'web_domain');

create type public.device_event_type as enum (
  'protection_enabled',
  'protection_disabled',
  'permission_revoked',
  'uninstall_attempt',
  'limit_reached',
  'pin_verified',
  'pin_failed'
);

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Planes (catálogo). Precios ILUSTRATIVOS — ver README: no son precios reales.
-- -----------------------------------------------------------------------------
create table public.plans (
  tier            public.plan_tier primary key,
  name            text        not null,
  price_usd_month numeric(6,2) not null default 0,
  max_monitored   int         not null check (max_monitored >= 0), -- a cuántas personas puede supervisar
  max_partners    int         not null check (max_partners >= 1),  -- cuántos socios puede tener
  features        jsonb       not null default '[]'::jsonb,
  is_public       boolean     not null default true,
  sort_order      int         not null default 0
);

insert into public.plans (tier, name, price_usd_month, max_monitored, max_partners, features, sort_order) values
  ('free',       'Gratis',     0.00, 1, 1, '["1 socio de confianza","Hasta 3 apps limitadas"]', 0),
  ('individual', 'Individual', 4.99, 1, 1, '["1 usuario monitoreado","Apps ilimitadas","Historial de peticiones"]', 1),
  ('pareja',     'Pareja',     7.99, 2, 1, '["2 usuarios monitoreados","Control cruzado entre ambos","Reportes semanales","Soporte prioritario"]', 2),
  ('familiar',   'Familiar',  12.99, 6, 2, '["Hasta 6 usuarios monitoreados","Un socio administrador central","Panel familiar compartido"]', 3);

-- -----------------------------------------------------------------------------
-- Perfiles (1:1 con auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                         uuid primary key references auth.users (id) on delete cascade,
  display_name               text        not null default '',
  avatar_url                 text,
  timezone                   text        not null default 'America/Bogota',
  locale                     text        not null default 'es',
  onboarding_completed       boolean     not null default false,
  emergency_unlocks_per_month int        not null default 2 check (emergency_unlocks_per_month between 0 and 10),
  emergency_unlock_minutes   int         not null default 10 check (emergency_unlock_minutes between 1 and 60),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea el perfil automáticamente al registrarse.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Suscripciones (las escribe el backend / webhook de pagos, nunca el cliente)
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid        not null references public.profiles (id) on delete cascade,
  tier               public.plan_tier not null references public.plans (tier),
  status             public.subscription_status not null default 'active',
  provider           text        not null default 'manual', -- 'revenuecat' | 'app_store' | 'play_store' | 'stripe' | 'manual'
  provider_ref       text,
  current_period_end timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index subscriptions_one_live_per_user
  on public.subscriptions (user_id) where status in ('trialing', 'active', 'past_due');

create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Dispositivos
-- -----------------------------------------------------------------------------
create table public.devices (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid        not null references public.profiles (id) on delete cascade,
  install_id         text        not null,             -- id estable generado en el dispositivo
  platform           public.platform not null,
  name               text,
  model              text,
  os_version         text,
  app_version        text,
  push_token         text,                             -- Expo push token
  protection_enabled boolean     not null default false,
  permissions        jsonb       not null default '{}'::jsonb, -- {"accessibility":true,"usage_stats":true,"family_controls":"approved"}
  last_seen_at       timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, install_id)
);

create index devices_user_idx on public.devices (user_id);

create trigger devices_updated_at before update on public.devices
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Invitaciones y relaciones usuario ↔ socio
-- -----------------------------------------------------------------------------
create table public.partner_invitations (
  id           uuid primary key default gen_random_uuid(),
  inviter_id   uuid        not null references public.profiles (id) on delete cascade,
  inviter_role public.invitation_role not null default 'monitored',
  code         text        not null unique,
  status       public.invitation_status not null default 'pending',
  accepted_by  uuid        references public.profiles (id) on delete set null,
  accepted_at  timestamptz,
  expires_at   timestamptz not null default now() + interval '7 days',
  created_at   timestamptz not null default now()
);

create index partner_invitations_inviter_idx on public.partner_invitations (inviter_id);

create table public.partnerships (
  id                  uuid primary key default gen_random_uuid(),
  monitored_id        uuid        not null references public.profiles (id) on delete cascade,
  partner_id          uuid        not null references public.profiles (id) on delete cascade,
  status              public.partnership_status not null default 'active',
  invitation_id       uuid        references public.partner_invitations (id) on delete set null,
  partner_pin_hash    text,                  -- PIN que el socio puede dar en persona (urgencias / desinstalar)
  revoke_requested_at timestamptz,
  revoke_effective_at timestamptz,
  revoked_by          uuid        references public.profiles (id) on delete set null,
  revoked_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (monitored_id <> partner_id)
);

create unique index partnerships_unique_live
  on public.partnerships (monitored_id, partner_id) where status <> 'revoked';
create index partnerships_partner_idx on public.partnerships (partner_id) where status <> 'revoked';
create index partnerships_monitored_idx on public.partnerships (monitored_id) where status <> 'revoked';

create trigger partnerships_updated_at before update on public.partnerships
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Reglas de límite y apps objetivo
-- -----------------------------------------------------------------------------
create table public.limit_rules (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid        not null references public.profiles (id) on delete cascade,
  name                text        not null,                       -- "Redes sociales"
  daily_limit_minutes int         not null default 60 check (daily_limit_minutes between 0 and 1440),
  active_days         smallint[]  not null default '{1,2,3,4,5,6,7}', -- ISO: 1 = lunes … 7 = domingo
  block_start         time,                                       -- franja opcional de bloqueo total (p. ej. 23:00)
  block_end           time,                                       -- (p. ej. 07:00)
  is_active           boolean     not null default true,
  updated_by          uuid        references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (active_days <@ '{1,2,3,4,5,6,7}'::smallint[]),
  check ((block_start is null) = (block_end is null))
);

create index limit_rules_user_idx on public.limit_rules (user_id);

create trigger limit_rules_updated_at before update on public.limit_rules
  for each row execute function public.set_updated_at();

create table public.rule_targets (
  id           uuid primary key default gen_random_uuid(),
  rule_id      uuid        not null references public.limit_rules (id) on delete cascade,
  user_id      uuid        not null references public.profiles (id) on delete cascade, -- desnormalizado para RLS
  platform     public.platform,              -- null = aplica a ambas (p. ej. web_domain)
  target_type  public.target_type not null default 'app',
  -- Android: package name (com.instagram.android)
  -- iOS: id local de la selección de FamilyActivityPicker (el token real es opaco y vive en el dispositivo)
  -- web_domain: instagram.com
  identifier   text        not null,
  display_name text        not null,
  device_id    uuid        references public.devices (id) on delete cascade, -- requerido para tokens iOS
  created_at   timestamptz not null default now(),
  unique (rule_id, platform, identifier)
);

create index rule_targets_user_idx on public.rule_targets (user_id);

-- -----------------------------------------------------------------------------
-- Peticiones (extensiones, urgencias, cambios de regla)
-- -----------------------------------------------------------------------------
create table public.extension_requests (
  id                uuid primary key default gen_random_uuid(),
  requester_id      uuid        not null references public.profiles (id) on delete cascade,
  device_id         uuid        references public.devices (id) on delete set null,
  rule_id           uuid        references public.limit_rules (id) on delete set null,
  kind              public.request_kind not null default 'time_extension',
  target_identifier text,                         -- app concreta (null = toda la regla)
  target_name       text,
  minutes_requested int         check (minutes_requested between 1 and 240),
  reason            text        check (char_length(reason) <= 280),
  payload           jsonb       not null default '{}'::jsonb, -- para rule_relax: cambios propuestos
  status            public.request_status not null default 'pending',
  decided_by        uuid        references public.profiles (id) on delete set null,
  decided_at        timestamptz,
  decision_note     text        check (char_length(decision_note) <= 280),
  minutes_granted   int         check (minutes_granted between 1 and 240),
  grant_starts_at   timestamptz,
  grant_ends_at     timestamptz,
  expires_at        timestamptz not null default now() + interval '30 minutes', -- si nadie decide
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (kind <> 'time_extension' or minutes_requested is not null)
);

create index extension_requests_requester_idx on public.extension_requests (requester_id, created_at desc);
create index extension_requests_pending_idx on public.extension_requests (requester_id) where status = 'pending';
create index extension_requests_grants_idx on public.extension_requests (requester_id, grant_ends_at) where status = 'approved';

create trigger extension_requests_updated_at before update on public.extension_requests
  for each row execute function public.set_updated_at();

-- Desbloqueos vigentes (lo consulta el dispositivo para levantar el bloqueo).
create view public.active_grants
with (security_invoker = true) as
  select id, requester_id, device_id, rule_id, kind, target_identifier, target_name,
         minutes_granted, grant_starts_at, grant_ends_at
  from public.extension_requests
  where status = 'approved' and grant_ends_at > now();

-- -----------------------------------------------------------------------------
-- Uso diario (el socio ve tiempos, nunca contenido)
-- -----------------------------------------------------------------------------
create table public.usage_daily (
  device_id    uuid        not null references public.devices (id) on delete cascade,
  user_id      uuid        not null references public.profiles (id) on delete cascade,
  usage_date   date        not null,
  identifier   text        not null,
  display_name text,
  minutes_used int         not null default 0 check (minutes_used between 0 and 1440),
  opens        int         not null default 0 check (opens >= 0),
  updated_at   timestamptz not null default now(),
  primary key (device_id, usage_date, identifier)
);

create index usage_daily_user_date_idx on public.usage_daily (user_id, usage_date desc);

create trigger usage_daily_updated_at before update on public.usage_daily
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Eventos del dispositivo (antimanipulación) y notificaciones
-- -----------------------------------------------------------------------------
create table public.device_events (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  device_id  uuid        references public.devices (id) on delete cascade,
  type       public.device_event_type not null,
  data       jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index device_events_user_idx on public.device_events (user_id, created_at desc);

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles (id) on delete cascade,
  type         text        not null, -- 'request_created' | 'request_decided' | 'partner_joined' | ...
  title        text        not null,
  body         text        not null,
  data         jsonb       not null default '{}'::jsonb,
  read_at      timestamptz,
  push_sent_at timestamptz,
  created_at   timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
