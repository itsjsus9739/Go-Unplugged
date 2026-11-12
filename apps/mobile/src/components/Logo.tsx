import { Image, useColorScheme } from 'react-native';

/**
 * Logo completo. Modo oscuro: versión a color con glitch (fondo transparente).
 * Modo claro: versión monocromática negra del kit de marca.
 */
export function Logo({ width = 220 }: { width?: number }) {
  const light = useColorScheme() === 'light';
  return (
    <Image
      source={light ? require('../../assets/logo_mono_black.png') : require('../../assets/logo-principal.png')}
      style={{ width, height: (width * 330) / 1024 }}
      resizeMode="contain"
      accessibilityLabel="Go Unplugged"
    />
  );
}
