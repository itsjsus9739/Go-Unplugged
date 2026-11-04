# Go Unplugged

App de bienestar digital basada en responsabilidad compartida: le entregas el control de tus límites de pantalla a
un **socio de confianza**. Cuando se agota tu tiempo pides una extensión y tu socio la aprueba o la deniega desde su
teléfono.

> «Go Unplugged convierte tus límites de pantalla en un acuerdo con alguien que te acompaña, no en una batalla que
> peleas solo.» — **Un límite · Un acuerdo · Más tiempo**

Proyecto académico — UNAB. Equipo: Jesús Tello, Sara Duarte, Marco Moreno.

## Qué hay en el repo

| Ruta | Qué es |
|---|---|
| [`apps/mobile/`](apps/mobile) | App **Android + iOS** (Expo / React Native + TypeScript) con módulo nativo de bloqueo |
| [`supabase/`](supabase) | Base de datos (migraciones SQL, RLS, funciones), Edge Function de push y pruebas |
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Decisiones, modelo de datos, reglas de negocio y flujo completo |
| [`docs/MOVIL.md`](docs/MOVIL.md) | Cómo correr la app y generar el **APK** y la build de **iOS** |
| [`brand/`](brand) | Manual de marca y assets (logos, íconos, app icons) |
| [`docs/referencia/`](docs/referencia) | Prototipo Python original, demo web, guion del video, propuesta de valor |
| `index.html`, `demo.html`, `personas.html` | Landing, demo interactivo y buyer personas |

## Inicio rápido

```bash
# 1. Base de datos (ver supabase/README.md)
npx supabase link --project-ref TU_PROJECT_REF && npx supabase db push

# 2. App
cd apps/mobile && npm install && cp .env.example .env   # completar URL y anon key
npm run build:apk     # APK de prueba vía EAS Build
```

## Estado

- ✅ Esquema de base de datos completo con RLS y lógica de negocio en el servidor (probado con escenarios SQL)
- ✅ App con autenticación, onboarding, invitación por código, límites, pantalla de bloqueo, peticiones en tiempo real,
  decisiones del socio (también desde la notificación), urgencias y PIN del socio
- ✅ Módulo nativo de bloqueo escrito (Android: Accessibility + UsageStats · iOS: Screen Time API)
- ⏳ Compilar y probar el módulo nativo en dispositivos reales
- ⏳ Entitlement Family Controls de Apple y declaración de Accesibilidad en Google Play
- ⏳ Pagos y precios reales (los actuales — $4.99 / $7.99 / $12.99 — son ilustrativos)

Identidad de marca: índigo `#3B34D0`, negro `#08090B`, acentos cian `#47CFCB` / magenta `#DA6997`, Poppins + Inter.
