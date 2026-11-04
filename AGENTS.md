# AGENTS.md — Contexto para agentes de código (Codex)

Este repo es el material de un proyecto académico (Go Unplugged, UNAB). Este archivo, `README.md` y `docs/ARQUITECTURA.md` son la memoria del proyecto. Léelos antes de tocar nada.

## Estado actual (nov. 2026)
- **App móvil**: `apps/mobile/` (Expo SDK 58 + Expo Router + TypeScript). Ver `apps/mobile/AGENTS.md` para reglas de Expo.
- **Backend**: Supabase (decidido). Esquema en `supabase/migrations/`. La lógica sensible vive en funciones SQL y triggers, no en la app.
- **Bloqueo nativo**: `apps/mobile/modules/app-blocker/` (Kotlin + Swift) y `apps/mobile/targets/device-activity-monitor/` (extensión iOS).
- Al cambiar el esquema: nueva migración + actualizar `supabase/tests/10_scenarios.sql` + `npm run gen:types`.

## Qué es Go Unplugged
App de bienestar digital: un usuario le delega a un "socio de confianza" la aprobación de cada extensión de tiempo de pantalla. Ver `README.md` para la propuesta de valor completa y el estado actual del proyecto.

## Qué puedes asumir de este repo
- **La web (`index.html`, `demo.html`, `personas.html`, `docs/referencia/demo-prototipo.html`) no tiene build system**: HTML autocontenido. La app móvil sí (npm + Expo).
- `docs/referencia/prototipo-gounplugged.py` es el prototipo original (Tkinter); `SocioResponsabilidad` y `GoUnplugged` son la referencia de comportamiento. Su equivalencia con el backend actual está en `docs/ARQUITECTURA.md` §5.
- **La identidad de marca ya está definida y no debe improvisarse.** Antes de generar cualquier UI nueva, lee `brand/manual-de-marca.html` y usa los tokens de `README.md` (color índigo `#3B34D0`, negro `#08090B`, Poppins + Inter). Los activos listos para usar (SVG, favicons, app icons, iconografía de producto) están en `brand/assets/` — no regenerar logos ni íconos desde cero si ya existen ahí.
- **Las cifras de negocio son estimaciones, no datos reales:** precios de suscripción, costos fijos/variables, tarifas de impuestos. Si se te pide "usar los datos reales del negocio", primero señala que estos son ilustrativos y pregunta si hay cifras actualizadas antes de construir algo sobre ellas.
- **El video promocional no está en el repo** (se entregó aparte) y su pipeline no se conservó; la especificación está en `docs/referencia/guion-tecnico-video.md`.

## App y bloqueo
- El bloqueo de apps a nivel de sistema operativo **no es viable en web**: vive en `apps/mobile/modules/app-blocker/`.
- Android: AccessibilityService + UsageStatsManager (Kotlin). iOS: Screen Time API (FamilyControls/ManagedSettings/DeviceActivity) con limitaciones fuertes — no prometer paridad de features (ver `docs/MOVIL.md`).
- No crear/editar `apps/mobile/android` ni `apps/mobile/ios` a mano (los genera `expo prebuild`).

## Convenciones a mantener si extiendes el HTML existente
- Self-contained: CSS y JS inline en el mismo archivo, sin añadir dependencias externas salvo que se justifique.
- Paleta y tipografía: usar las variables ya definidas en el `<style>` de `index.html` en vez de inventar nuevos tokens de color.
- Español en todo el copy orientado al usuario final; comentarios de código pueden ir en español o inglés indistintamente, como ya está.
