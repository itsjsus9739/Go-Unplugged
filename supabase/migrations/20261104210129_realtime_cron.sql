-- =============================================================================
-- Go Unplugged — Realtime y tareas programadas
-- =============================================================================

-- Realtime: el teléfono del usuario escucha sus peticiones/desbloqueos y el del
-- socio escucha las peticiones nuevas (sustituye al botón "Sincronizar
-- permisos" del prototipo). Las suscripciones respetan RLS.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.extension_requests,
      public.notifications,
      public.partnerships,
      public.limit_rules,
      public.rule_targets;
  end if;
end;
$$;

-- pg_cron: expira peticiones/invitaciones y cierra revocaciones cada 5 min.
-- En Supabase pg_cron está disponible (Database → Extensions).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('gounplugged-maintenance', '*/5 * * * *', 'select public.run_maintenance();');
  else
    raise notice 'pg_cron no disponible: ejecuta public.run_maintenance() desde otro scheduler.';
  end if;
end;
$$;
