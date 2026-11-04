# Arquitectura — Go Unplugged (app móvil + Supabase)

> Estado: **estructura base** (nov. 2026). La lógica de negocio y la base de datos están completas y probadas;
> el bloqueo nativo está escrito pero falta compilarlo y probarlo en dispositivos reales.

## 1. Decisiones

| Tema | Decisión | Por qué |
|---|---|---|
| App móvil | **Expo (React Native + TypeScript), SDK 58**, Expo Router | Un solo código para Android e iOS; módulos nativos propios en Kotlin/Swift para el bloqueo; APK/IPA en la nube con **EAS Build** (no hace falta Mac para compilar iOS). El equipo ya trabaja en JS (demo web). |
| Backend | **Supabase** (Postgres + Auth + Realtime + Edge Functions) | El dominio es relacional (usuario ↔ socio ↔ reglas ↔ peticiones) y la seguridad cabe en **RLS**; Realtime reemplaza el botón «Sincronizar» del prototipo; plan gratuito suficiente para el piloto. |
| Alternativa descartada | Firebase (Firestore/RTDB) | Funciona, pero las reglas de seguridad para «el socio puede aflojar, el usuario solo endurecer» y los cupos por plan son mucho más fáciles de expresar en SQL con triggers/RPC. |
| Bloqueo Android | **AccessibilityService** + **UsageStatsManager** | Única vía realista para detectar la app en primer plano y bloquearla. |
| Bloqueo iOS | **Screen Time API**: FamilyControls + ManagedSettings + DeviceActivity | Apple no permite otra forma. Requiere entitlement especial (ver `docs/MOVIL.md`). |
| Push | Expo Push API desde una Edge Function | Un solo token para FCM/APNs. |
| Pagos | **Pendiente** (recomendado: RevenueCat → webhook que escribe `subscriptions`) | Precios actuales son ilustrativos. |

## 2. Estructura del repo

```
Go-Unplugged/
├── apps/mobile/                 App Expo (Android + iOS)
│   ├── src/app/                 Pantallas (Expo Router)
│   │   ├── (auth)/              Bienvenida, login, registro
│   │   ├── onboarding.tsx       Rol → conectar socio por código → permisos
│   │   └── (app)/
│   │       ├── (tabs)/          Hoy · Límites · Acuerdo · Cuenta
│   │       ├── blocked.tsx      Pantalla de bloqueo / pedir extensión (deep link gounplugged://blocked)
│   │       ├── request/[id].tsx Detalle de petición (desde push): aprobar X min / denegar
│   │       └── rules/           Crear / editar límites y apps
│   ├── src/services/            Acceso a Supabase (auth, reglas, peticiones, dispositivos, sync del bloqueo)
│   ├── src/providers/           Sesión + sincronización en tiempo real
│   ├── src/theme/               Tokens de marca (índigo #3B34D0, negro #08090B, Poppins + Inter)
│   ├── src/types/database.ts    Tipos de la BD (regenerables con `npm run gen:types`)
│   ├── modules/app-blocker/     Módulo nativo local (Kotlin + Swift) — ver §5
│   └── targets/device-activity-monitor/  Extensión iOS (Screen Time) generada con @bacons/apple-targets
├── supabase/
│   ├── migrations/              Esquema, RLS, funciones RPC, realtime/cron
│   ├── functions/send-push/     Edge Function: notificaciones push
│   ├── tests/                   Escenarios SQL de punta a punta (Postgres local)
│   └── seed.sql                 Usuarios demo Francisco/Mariana
├── brand/                       Manual y assets de marca
├── docs/                        Esta documentación + referencia (prototipo Python, demo, guion)
└── index.html, demo.html, personas.html   Landing y material web existente
```

## 3. Modelo de datos

```
auth.users ─1:1─ profiles ─┬─< devices ─< usage_daily
                           ├─< subscriptions >── plans
                           ├─< partner_invitations
                           ├─< partnerships (monitored_id, partner_id)   ← el "acuerdo"
                           ├─< limit_rules ─< rule_targets               ← qué apps y cuánto
                           ├─< extension_requests                        ← peticiones/decisiones/desbloqueos
                           ├─< device_events                             ← antimanipulación
                           └─< notifications                             ← bandeja + push
view active_grants = extension_requests aprobadas con grant_ends_at > now()
```

| Tabla | Para qué |
|---|---|
| `profiles` | Nombre visible, zona horaria, cupo de urgencias (por defecto 2/mes de 10 min). |
| `partnerships` | Relación monitoreado → socio. Estados `active` / `revoking` (24 h de enfriamiento si la termina el monitoreado) / `revoked`. Guarda el hash del **PIN del socio**. |
| `partner_invitations` | Código de 8 caracteres (7 días). `inviter_role` decide quién será el socio. |
| `limit_rules` | Límite diario en minutos, días activos (ISO 1–7) y franja opcional de bloqueo total (p. ej. 23:00–07:00). |
| `rule_targets` | Apps del límite. Android: *package name*. iOS: `ios-selection:<rule_id>` (los tokens reales son opacos y viven en el teléfono). |
| `extension_requests` | `time_extension`, `emergency` (autoaprobada con cupo), `rule_relax` (aflojar un límite: `payload` con los cambios), `disable_protection`. Al aprobar se fija `grant_starts_at`/`grant_ends_at`. Expira a los 30 min sin respuesta. |
| `usage_daily` | Minutos por app y día (el socio ve tiempos, **nunca contenido**). |
| `device_events` | `protection_disabled`, `permission_revoked`, `uninstall_attempt`, `limit_reached`… Los tres primeros avisan al socio automáticamente. |
| `plans` / `subscriptions` | Catálogo (precios **ilustrativos**) y suscripción vigente; límites de personas por plan se validan al aceptar invitaciones. |

## 4. Reglas de negocio (en la base de datos, no en la app)

Todo lo sensible está en funciones `security definer` y triggers, así un cliente modificado no puede saltárselo:

1. **Solo el socio afloja.** Con socio activo, el usuario puede *endurecer* sus reglas (menos minutos, más días, más apps), pero subir minutos, pausar, quitar días/apps, borrar la regla o subir su cupo de urgencias lanza `rule_relax_requires_partner`. La app lo convierte automáticamente en una petición `rule_relax`.
2. **Nadie se aprueba a sí mismo.** `decide_request` exige ser socio activo del solicitante.
3. **Urgencias con cupo.** `request_extension('emergency')` se aprueba sola si queda cupo en el mes (zona horaria del usuario) y notifica al socio.
4. **Terminar el acuerdo no es un atajo.** Si lo termina el monitoreado, queda `revoking` 24 h (sigue sin poder aflojar) y se avisa al socio; `run_maintenance()` (pg_cron cada 5 min) lo cierra.
5. **PIN del socio** con bcrypt y máximo 5 intentos fallidos cada 15 min; cada uso se notifica.
6. **Antispam**: repetir una petición pendiente equivalente devuelve la existente.

RPC expuestas a la app: `create_invitation`, `accept_invitation`, `revoke_partnership`, `set_partner_pin`, `verify_partner_pin`, `request_extension`, `decide_request`, `cancel_request`.

## 5. Flujo de punta a punta

Equivalencia con el prototipo (`docs/referencia/prototipo-gounplugged.py`):

| Prototipo | Ahora |
|---|---|
| `intentar_acceso("instagram.com")` → bloqueado | El servicio nativo detecta Instagram con el límite agotado → abre `gounplugged://blocked?app=…&rule=…` |
| `socio.recibir_solicitud()` | `request_extension()` → fila en `extension_requests` + `notifications` → webhook → Edge Function `send-push` → push al socio con botones **Aprobar / Denegar** |
| `aprobar_desbloqueo()` | `decide_request()` (el socio puede ajustar los minutos y dejar una nota) |
| `sincronizar_autorizacion()` (botón) | **Automático**: Realtime avisa al teléfono → `syncBlocking()` baja reglas + `active_grants` → `AppBlocker.setConfig()` → el servicio nativo deja pasar hasta `grant_ends_at` |

El bloqueador nativo trabaja **offline** con la última configuración guardada (SharedPreferences / App Group); los eventos `limit_reached` se suben a `device_events` cuando hay red.

## 6. Seguridad y privacidad

- RLS activo en todas las tablas; grants por columna (p. ej. el cliente solo puede cambiar `read_at` de una notificación).
- El socio ve: perfil, reglas, apps limitadas, minutos de uso, peticiones y eventos del dispositivo. **No** hay ninguna tabla con contenido de pantalla, mensajes o publicaciones.
- La `anon key` va en la app (es pública por diseño); la `service_role` solo vive en la Edge Function.
- Pruebas: `supabase/tests/10_scenarios.sql` cubre invitaciones, guardas de relajación, aislamiento entre usuarios, aprobación/denegación, urgencias, `rule_relax`, PIN, avisos de manipulación y revocación.

## 7. Pendientes

- [ ] Compilar y probar en dispositivos el módulo nativo (Android y iOS) — no se pudo compilar en este entorno.
- [ ] Solicitar a Apple el entitlement *Family Controls (Distribution)*.
- [ ] Declarar el uso de AccessibilityService en Google Play (formulario + divulgación destacada).
- [ ] Extensiones iOS opcionales: `shield-config` (pantalla de bloqueo con la marca) y `DeviceActivityReport` (minutos de uso en iOS).
- [ ] Pagos (RevenueCat) y precios reales.
- [ ] Protección contra desinstalación en Android (Device Admin) usando el PIN del socio.
- [ ] Login con Apple/Google.
