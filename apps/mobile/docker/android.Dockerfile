# syntax=docker/dockerfile:1
# =============================================================================
# Go Unplugged — compila el APK de Android 100 % local, dentro de Docker.
# No necesita cuenta de Expo ni Android Studio.
#
# Uso (desde apps/mobile):
#   docker build --platform linux/amd64 -f docker/android.Dockerfile --target export --output dist .
# Resultado: apps/mobile/dist/go-unplugged.apk
#
# Notas:
#  - --platform linux/amd64 es obligatorio en Mac con Apple Silicon (las herramientas
#    de Android para Linux solo existen en x86_64); allí será más lento por emulación.
#  - Docker necesita >= 6 GB de RAM (Docker Desktop → Settings → Resources).
#  - El APK queda firmado con la clave de depuración: sirve para instalar y probar,
#    no para subir a Google Play (para eso: EAS Build o un keystore propio).
# =============================================================================
FROM node:22-bookworm AS build

RUN apt-get update \
 && apt-get install -y --no-install-recommends openjdk-17-jdk-headless unzip \
 && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
    ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    CI=1
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# Android command-line tools. El resto del SDK (platform, build-tools, NDK, CMake)
# lo descarga Gradle automáticamente en la versión exacta que pide React Native.
RUN mkdir -p $ANDROID_HOME/cmdline-tools \
 && curl -fsSL -o /tmp/clt.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
 && unzip -q /tmp/clt.zip -d $ANDROID_HOME/cmdline-tools \
 && mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest \
 && rm /tmp/clt.zip \
 && yes | sdkmanager --licenses > /dev/null \
 && sdkmanager "platform-tools"

WORKDIR /app

# Dependencias primero (se cachea mientras package-lock.json no cambie)
COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

# Valores públicos de Supabase (la publishable key es pública por diseño; RLS protege los datos)
ARG EXPO_PUBLIC_SUPABASE_URL=https://qvdtjteawqzoqbilnzeg.supabase.co
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_6yhOiYlvLFZ9rDyZZu0IUw_lNvjw4u9
ENV EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL \
    EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY

# Genera el proyecto nativo android/ (Continuous Native Generation)
RUN npx expo prebuild -p android --no-install --clean

# Solo arm64-v8a (casi todos los teléfonos actuales): compila ~4 veces más rápido.
# Para un APK universal usa: --build-arg ABIS=armeabi-v7a,arm64-v8a,x86,x86_64
ARG ABIS=arm64-v8a
RUN cd android \
 && ./gradlew assembleRelease --no-daemon \
      -Dorg.gradle.jvmargs="-Xmx4g -XX:MaxMetaspaceSize=1g" \
      -PreactNativeArchitectures=$ABIS

# Etapa final: solo el APK (docker build --output lo copia a tu carpeta)
FROM scratch AS export
COPY --from=build /app/android/app/build/outputs/apk/release/app-release.apk /go-unplugged.apk
