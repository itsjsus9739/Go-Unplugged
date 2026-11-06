# App móvil: cómo correrla y generar el APK / IPA

Todo se hace desde `apps/mobile/`. Requisitos: Node 20+ y una cuenta gratuita de [Expo](https://expo.dev).

## 1. Configurar

```bash
cd apps/mobile
npm install
cp .env.example .env   # pega la URL y la anon key de Supabase
npx eas-cli@latest login
npx eas-cli@latest init   # crea el proyecto en EAS y escribe extra.eas.projectId en app.json (necesario para push)
```

## 2. Desarrollar

El bloqueo usa código nativo propio, así que **Expo Go no sirve para probar el bloqueo** (la app corre en «modo demo»:
todo lo de Supabase funciona, pero no bloquea). Para probarlo de verdad se usa un *development build*:

```bash
npm run build:dev        # eas build --profile development (APK de desarrollo / build iOS interna)
npm start                # servidor de desarrollo; abre la app instalada
```

Con Android Studio instalado también sirve `npm run android` (compila localmente).

## 3. Generar el APK (Android)

```bash
npm run build:apk        # eas build -p android --profile preview  →  link de descarga del .apk
```

Para Google Play: `npx eas-cli@latest build -p android --profile production` (genera .aab).

**Permisos que el usuario concede a mano** (la app lo guía en el paso 3 del onboarding):
1. *Acceso a datos de uso* (minutos por app).
2. *Accesibilidad → Go Unplugged · Bloqueo de apps* (detectar la app en primer plano).

> ⚠️ **Google Play** revisa con lupa el uso de `AccessibilityService` en apps que no son de accesibilidad.
> Antes de publicar hay que llenar la declaración de permisos en Play Console, mostrar una divulgación destacada
> (la pantalla de permisos ya explica qué hace y qué NO lee) y justificar el caso de bienestar digital/control parental.
> El APK de instalación directa no tiene esta restricción.

## 3b. Generar el APK con Docker (sin cuenta de Expo)

Requisitos: Docker Desktop con **6 GB de RAM o más** y unos 15 GB libres. Desde `apps/mobile`:

```bash
docker build --platform linux/amd64 -f docker/android.Dockerfile --target export --output dist .
```

El APK queda en `apps/mobile/dist/go-unplugged.apk`. La primera vez tarda 20–40 min (descarga SDK, NDK y
dependencias); después Docker reutiliza las capas en caché. Está firmado con la clave de depuración: sirve para
instalar y probar, no para Google Play. En Mac con chip Apple corre emulado (más lento).

## 4. Generar la app de iOS

1. Cuenta de Apple Developer (99 USD/año). Agrega tu Team ID en `app.json` → `expo.ios.appleTeamId`.
2. **Solicita el entitlement Family Controls**: <https://developer.apple.com/contact/request/family-controls-distribution>.
   Sin la aprobación de Apple solo funciona en builds de desarrollo; para TestFlight/App Store es obligatorio
   (para la app **y** para la extensión `com.gounplugged.app.device-activity-monitor`).
3. `npm run build:ios` (EAS compila en la nube, no hace falta Mac). Para instalar en un iPhone de prueba:
   `npx eas-cli@latest device:create` antes del build.

### Limitaciones de iOS (importante para no prometer de más)

- iOS **no deja listar las apps instaladas**: el usuario las elige con el selector de Apple (`FamilyActivityPicker`) y
  la app solo recibe tokens opacos. El socio ve «3 apps, 1 categoría», no los nombres.
- iOS **no da los minutos de uso a la app**. Para mostrarlos hay que agregar una extensión `DeviceActivityReport`
  (pendiente). El bloqueo por límite sí funciona: lo hace la extensión `DeviceActivityMonitor`.
- La pantalla de bloqueo en iOS es el escudo del sistema; no puede abrir la app directamente. Se puede personalizar
  con una extensión `shield-config` y avisar con una notificación local (pendiente).
- Los intervalos de `DeviceActivity` son de mínimo 15 min; los desbloqueos más cortos se controlan con un evento de umbral.

## 5. Módulo nativo `modules/app-blocker`

API JS (`modules/app-blocker/index.ts`):

| Función | Android | iOS |
|---|---|---|
| `getPermissions()` | usage access + accesibilidad | autorización FamilyControls |
| `requestAuthorization()` | abre Ajustes | diálogo de Tiempo en pantalla |
| `getLaunchableApps()` | apps con ícono | `[]` (usar `presentAppPicker`) |
| `presentAppPicker(ruleId)` | — | `FamilyActivityPicker` |
| `getUsageToday(ids)` | minutos desde medianoche | `{}` |
| `setConfig(config)` | guarda en SharedPreferences (lo lee el servicio) | guarda en App Group y programa DeviceActivity |
| `consumeBlockEvents()` | bloqueos ocurridos | idem |

Formato de `config` (igual en Kotlin y Swift): ver `src/AppBlocker.types.ts`.
