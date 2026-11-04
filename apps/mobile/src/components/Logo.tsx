import { Image } from 'react-native';

export function Logo({ width = 220 }: { width?: number }) {
  // logo-principal.png: 1024×330 (candado + "Go Unplugged" con glitch cian/magenta)
  return (
    <Image
      source={require('../../assets/logo-principal.png')}
      style={{ width, height: (width * 330) / 1024 }}
      resizeMode="contain"
      accessibilityLabel="Go Unplugged"
    />
  );
}
