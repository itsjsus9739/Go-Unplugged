# Supabase — Go Unplugged

> **Proyecto en uso:** `go unplugged` · ref `qvdtjteawqzoqbilnzeg` · región `us-east-2` ·
> URL `https://qvdtjteawqzoqbilnzeg.supabase.co`. Las 4 migraciones de `migrations/` ya están aplicadas
> (incluye RLS, Realtime y el job de pg_cron). Falta solo el paso 4 (Edge Function de push + webhook).

## Crear el proyecto y aplicar el esquema

1. Crea un proyecto en <https://supabase.com> (región sugerida: `us-east-1` o la más cercana a Colombia).
2. Instala la CLI y enlaza el repo:

```bash
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push            # aplica supabase/migrations/*
```

3. **Database → Extensions**: verifica que `pg_cron` esté activo (la migración 4 lo activa si está disponible) para
   que `run_maintenance()` corra cada 5 minutos.
4. **Edge Function de push**:

```bash
npx supabase functions deploy send-push
npx supabase secrets set PUSH_WEBHOOK_SECRET=$(openssl rand -hex 24)
```

   Luego en **Database → Webhooks**: tabla `notifications`, evento `INSERT`, tipo *Supabase Edge Function* →
   `send-push`, header `x-webhook-secret: <el mismo valor>`.
5. **Authentication → URL configuration**: agrega `gounplugged://**` a las Redirect URLs.
6. Copia *Project URL* y *anon/publishable key* (Settings → API) a `apps/mobile/.env`.

## Desarrollo local (opcional, requiere Docker)

```bash
npx supabase start      # levanta Postgres + Auth + Realtime + Studio
npx supabase db reset   # aplica migraciones + seed.sql (francisco@demo.test / mariana@demo.test, clave: gounplugged)
```

## Pruebas del esquema sin Docker

`tests/run_local.sh` crea un Postgres temporal, aplica un stub mínimo de Supabase (`auth.uid()`, roles), todas las
migraciones y `tests/10_scenarios.sql` (flujo Francisco ↔ Mariana, seguridad RLS, guardas, urgencias, PIN, revocación):

```bash
PG_BIN=/usr/lib/postgresql/16/bin ./supabase/tests/run_local.sh
```

(`initdb` no corre como root: ejecútalo con un usuario normal.)

## Migraciones

| Archivo | Contenido |
|---|---|
| `20261104205946_schema.sql` | Tipos, tablas, índices, vista `active_grants`, trigger de perfil al registrarse, catálogo de planes |
| `20261104210018_rls.sql` | Helpers `is_partner_of` / `is_connected_to`, políticas RLS y grants por columna |
| `20261104210126_functions.sql` | RPC de negocio, guardas «solo el socio afloja», avisos antimanipulación, mantenimiento |
| `20261104210129_realtime_cron.sql` | Publicación Realtime y job de pg_cron |

Cambios futuros: siempre en una migración nueva (`npx supabase migration new <nombre>`), nunca editando las ya aplicadas.
Después de cambiar el esquema: `cd apps/mobile && npm run gen:types`.
