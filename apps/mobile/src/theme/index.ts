import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type ThemeColors } from './tokens';

export * from './tokens';

/** La marca es oscura por defecto (negro + índigo); respeta el modo claro del sistema. */
export function useThemeColors(): ThemeColors {
  return useColorScheme() === 'light' ? lightColors : darkColors;
}
