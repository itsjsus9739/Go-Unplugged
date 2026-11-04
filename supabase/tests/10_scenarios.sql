-- Escenarios de punta a punta (flujo del prototipo Francisco ↔ Mariana).
-- Se ejecuta como superusuario y cambia a rol "authenticated" simulando JWTs.

\set francisco '11111111-1111-1111-1111-111111111111'
\set mariana   '22222222-2222-2222-2222-222222222222'
\set intruso   '33333333-3333-3333-3333-333333333333'

insert into auth.users (id, email, raw_user_meta_data) values
  (:'francisco', 'francisco@example.com', '{"display_name":"Francisco"}'),
  (:'mariana',   'mariana@example.com',   '{"display_name":"Mariana"}'),
  (:'intruso',   'intruso@example.com',   '{}');

create function pg_temp.expect_error(p_sql text, p_msg text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'Se esperaba el error "%" pero no ocurrió: %', p_msg, p_sql;
exception when others then
  if sqlerrm not like '%' || p_msg || '%' then
    raise exception 'Error inesperado. Esperado "%", obtenido "%"', p_msg, sqlerrm;
  end if;
end;
$$;

create function pg_temp.assert(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if not coalesce(p_cond, false) then raise exception 'ASSERT: %', p_msg; end if;
end;
$$;

create table pg_temp.ctx (k text primary key, v text);
grant all on pg_temp.ctx to authenticated;

-- Perfiles creados por trigger
select pg_temp.assert((select display_name from public.profiles where id = :'francisco') = 'Francisco', 'perfil Francisco');
select pg_temp.assert((select display_name from public.profiles where id = :'intruso') = 'intruso', 'perfil por email');

-- ---------------------------------------------------------------------------
-- 1. Francisco invita, Mariana acepta
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'francisco', false);

insert into pg_temp.ctx select 'code', code from public.create_invitation('monitored');
select pg_temp.assert(length((select v from pg_temp.ctx where k = 'code')) = 8, 'código de 8 chars');

-- Sin socio todavía: Francisco puede hacer lo que quiera con sus reglas
insert into public.limit_rules (user_id, name, daily_limit_minutes)
values (:'francisco', 'Redes sociales', 60);
insert into pg_temp.ctx select 'rule', id::text from public.limit_rules where user_id = :'francisco';
update public.limit_rules set daily_limit_minutes = 45 where user_id = :'francisco';

insert into public.devices (user_id, install_id, platform, name)
values (:'francisco', 'install-abc', 'android', 'Pixel de Francisco');
insert into pg_temp.ctx select 'device', id::text from public.devices where user_id = :'francisco';

insert into public.rule_targets (rule_id, user_id, platform, identifier, display_name)
select v::uuid, :'francisco', 'android', 'com.instagram.android', 'Instagram' from pg_temp.ctx where k = 'rule';
insert into public.rule_targets (rule_id, user_id, platform, identifier, display_name)
select v::uuid, :'francisco', 'android', 'com.zhiliaoapp.musically', 'TikTok' from pg_temp.ctx where k = 'rule';

-- No puede aceptar su propia invitación
select pg_temp.expect_error(
  format('select public.accept_invitation(%L)', (select v from pg_temp.ctx where k = 'code')),
  'cannot_accept_own_invitation');

-- Sin socio no se puede pedir extensión
select pg_temp.expect_error('select public.request_extension(''time_extension'', 15)', 'no_active_partner');

select set_config('request.jwt.claim.sub', :'mariana', false);
select pg_temp.expect_error('select public.accept_invitation(''NOPE1234'')', 'invitation_not_found');
select public.accept_invitation(lower((select v from pg_temp.ctx where k = 'code'))); -- tolera minúsculas
select pg_temp.expect_error(
  format('select public.accept_invitation(%L)', (select v from pg_temp.ctx where k = 'code')),
  'invitation_not_pending');

-- Mariana ve el perfil, reglas, apps y dispositivo de Francisco
select pg_temp.assert((select count(*) from public.profiles) = 2, 'socio ve 2 perfiles');
select pg_temp.assert((select count(*) from public.rule_targets) = 2, 'socio ve apps');
select pg_temp.assert((select count(*) from public.devices) = 1, 'socio ve dispositivo');

select set_config('request.jwt.claim.sub', :'francisco', false);
select pg_temp.assert((select count(*) from public.notifications where type = 'partner_joined') = 1, 'aviso partner_joined');

-- ---------------------------------------------------------------------------
-- 2. Con socio: Francisco solo puede endurecer
-- ---------------------------------------------------------------------------
select pg_temp.expect_error(
  format('update public.limit_rules set daily_limit_minutes = 120 where id = %L', (select v from pg_temp.ctx where k = 'rule')),
  'rule_relax_requires_partner');
select pg_temp.expect_error(
  format('update public.limit_rules set is_active = false where id = %L', (select v from pg_temp.ctx where k = 'rule')),
  'rule_relax_requires_partner');
select pg_temp.expect_error(
  format('delete from public.limit_rules where id = %L', (select v from pg_temp.ctx where k = 'rule')),
  'rule_relax_requires_partner');
select pg_temp.expect_error(
  'delete from public.rule_targets where identifier = ''com.instagram.android''',
  'rule_relax_requires_partner');
select pg_temp.expect_error(
  'update public.profiles set emergency_unlocks_per_month = 9',
  'rule_relax_requires_partner');
update public.limit_rules set daily_limit_minutes = 30 where id = (select v::uuid from pg_temp.ctx where k = 'rule');
update public.profiles set emergency_unlocks_per_month = 1;

-- ---------------------------------------------------------------------------
-- 3. Petición de extensión (intentar_acceso -> aprobar -> sincronizar)
-- ---------------------------------------------------------------------------
insert into pg_temp.ctx
select 'req', id::text from public.request_extension(
  'time_extension', 15, 'Tengo que responder un mensaje del grupo de la U',
  (select v::uuid from pg_temp.ctx where k = 'rule'), 'com.instagram.android', 'Instagram',
  (select v::uuid from pg_temp.ctx where k = 'device'));

-- Repetir la misma petición devuelve la existente (antispam)
select pg_temp.assert(
  (select id from public.request_extension('time_extension', 15, null,
     (select v::uuid from pg_temp.ctx where k = 'rule'), 'com.instagram.android', 'Instagram'))
  = (select v::uuid from pg_temp.ctx where k = 'req'), 'antispam');

-- Francisco no puede aprobarse a sí mismo
select pg_temp.expect_error(
  format('select public.decide_request(%L, true)', (select v from pg_temp.ctx where k = 'req')),
  'request_not_found');

-- Un intruso no ve nada
select set_config('request.jwt.claim.sub', :'intruso', false);
select pg_temp.assert((select count(*) from public.extension_requests) = 0, 'intruso no ve peticiones');
select pg_temp.assert((select count(*) from public.limit_rules) = 0, 'intruso no ve reglas');
select pg_temp.assert((select count(*) from public.profiles) = 1, 'intruso solo se ve a sí mismo');
select pg_temp.expect_error(
  format('select public.decide_request(%L, true)', (select v from pg_temp.ctx where k = 'req')),
  'request_not_found');
select pg_temp.expect_error(
  format('insert into public.limit_rules (user_id, name) values (%L, ''hack'')', :'francisco'),
  'row-level security');

-- Mariana recibe la notificación y aprueba 10 min (en vez de 15)
select set_config('request.jwt.claim.sub', :'mariana', false);
select pg_temp.assert((select count(*) from public.notifications where type = 'request_created') = 1, 'aviso al socio');
select public.decide_request((select v::uuid from pg_temp.ctx where k = 'req'), true, 10, 'Solo 10, ¡ánimo!');
select pg_temp.expect_error(
  format('select public.decide_request(%L, false)', (select v from pg_temp.ctx where k = 'req')),
  'request_not_pending');

select set_config('request.jwt.claim.sub', :'francisco', false);
select pg_temp.assert((select minutes_granted from public.active_grants) = 10, 'grant activo de 10 min');
select pg_temp.assert((select count(*) from public.notifications where type = 'request_decided') = 1, 'aviso de decisión');

-- Denegación
insert into pg_temp.ctx select 'req2', id::text from public.request_extension('time_extension', 30, null, null, 'com.zhiliaoapp.musically', 'TikTok');
select set_config('request.jwt.claim.sub', :'mariana', false);
select public.decide_request((select v::uuid from pg_temp.ctx where k = 'req2'), false);
select pg_temp.assert((select status from public.extension_requests where id = (select v::uuid from pg_temp.ctx where k = 'req2')) = 'denied', 'denegada');

-- ---------------------------------------------------------------------------
-- 4. Urgencias con cupo
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'francisco', false);
select public.request_extension('emergency', null, 'Llamada del trabajo');
select pg_temp.expect_error('select public.request_extension(''emergency'')', 'emergency_quota_exhausted');
select pg_temp.assert((select count(*) from public.active_grants where kind = 'emergency') = 1, 'grant de urgencia');

-- ---------------------------------------------------------------------------
-- 5. Relajar una regla vía petición
-- ---------------------------------------------------------------------------
select pg_temp.expect_error(
  'select public.request_extension(''rule_relax'', null, null, null, null, null, null, ''{"daily_limit_minutes":90}'')',
  'rule_required');
select pg_temp.expect_error(
  format('select public.request_extension(''rule_relax'', null, null, %L, null, null, null, ''{"user_id":"x"}'')',
         (select v from pg_temp.ctx where k = 'rule')),
  'invalid_payload');
insert into pg_temp.ctx
select 'relax', id::text from public.request_extension(
  'rule_relax', null, 'Fin de semana', (select v::uuid from pg_temp.ctx where k = 'rule'), null, null, null,
  jsonb_build_object('daily_limit_minutes', 90, 'active_days', jsonb_build_array(1,2,3,4,5),
                     'remove_target_ids', jsonb_build_array((select id from public.rule_targets where identifier = 'com.zhiliaoapp.musically'))));

select set_config('request.jwt.claim.sub', :'mariana', false);
select public.decide_request((select v::uuid from pg_temp.ctx where k = 'relax'), true);
select pg_temp.assert((select daily_limit_minutes from public.limit_rules) = 90, 'límite relajado');
select pg_temp.assert((select active_days from public.limit_rules) = '{1,2,3,4,5}', 'días cambiados');
select pg_temp.assert((select count(*) from public.rule_targets) = 1, 'TikTok quitado');

-- El socio puede editar directamente
update public.limit_rules set daily_limit_minutes = 60;
select pg_temp.assert((select daily_limit_minutes from public.limit_rules) = 60, 'socio edita');

-- ---------------------------------------------------------------------------
-- 6. PIN del socio
-- ---------------------------------------------------------------------------
select pg_temp.expect_error(
  format('select public.set_partner_pin(%L, ''12'')', (select id from public.partnerships)), 'invalid_pin');
select public.set_partner_pin((select id from public.partnerships), '4821');

select set_config('request.jwt.claim.sub', :'francisco', false);
select pg_temp.assert(not public.verify_partner_pin('0000'), 'pin incorrecto');
select pg_temp.assert(public.verify_partner_pin('4821'), 'pin correcto');
select pg_temp.expect_error(
  'insert into public.device_events (user_id, type) values (auth.uid(), ''pin_verified'')', 'row-level security');

-- Evento de manipulación -> aviso al socio
insert into public.device_events (user_id, device_id, type)
values (:'francisco', (select v::uuid from pg_temp.ctx where k = 'device'), 'protection_disabled');
select set_config('request.jwt.claim.sub', :'mariana', false);
select pg_temp.assert((select count(*) from public.notifications where type = 'tamper_protection_disabled') = 1, 'aviso tamper');
select pg_temp.assert((select count(*) from public.notifications where type = 'pin_used') = 1, 'aviso pin');

-- ---------------------------------------------------------------------------
-- 7. Revocación: monitoreado => 24 h de enfriamiento
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'francisco', false);
select pg_temp.assert(
  (select status from public.revoke_partnership((select id from public.partnerships))) = 'revoking', 'revoking');
-- durante el enfriamiento sigue sin poder relajar
select pg_temp.expect_error('update public.limit_rules set daily_limit_minutes = 500', 'rule_relax_requires_partner');

reset role;
update public.partnerships set revoke_effective_at = now() - interval '1 minute';
select public.run_maintenance();
select pg_temp.assert((select status from public.partnerships) = 'revoked', 'revocada por mantenimiento');

-- Columnas protegidas
set role authenticated;
select set_config('request.jwt.claim.sub', :'francisco', false);
select pg_temp.expect_error('update public.notifications set title = ''x''', 'permission denied');
select pg_temp.expect_error('update public.profiles set id = gen_random_uuid()', 'permission denied');
select pg_temp.expect_error('select public.run_maintenance()', 'permission denied');
reset role;
