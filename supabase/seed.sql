-- Datos de desarrollo local (`supabase db reset`). Los planes ya vienen en la migración.
-- Crea dos usuarios de prueba: francisco@demo.test / mariana@demo.test (contraseña: gounplugged)
-- y los conecta como en el prototipo (Mariana es socia de Francisco).
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'francisco@demo.test', extensions.crypt('gounplugged', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Francisco"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'mariana@demo.test', extensions.crypt('gounplugged', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Mariana"}', now(), now());

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now()
from auth.users where email like '%@demo.test';

insert into public.partnerships (monitored_id, partner_id)
values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

insert into public.limit_rules (id, user_id, name, daily_limit_minutes)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Redes sociales', 60);

insert into public.rule_targets (rule_id, user_id, platform, identifier, display_name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'android', 'com.instagram.android', 'Instagram'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'android', 'com.zhiliaoapp.musically', 'TikTok'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'android', 'com.twitter.android', 'X');
