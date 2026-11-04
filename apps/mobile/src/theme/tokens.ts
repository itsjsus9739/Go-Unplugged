/**
 * Tokens de marca (README del proyecto + brand/manual-de-marca.html).
 * No improvisar colores nuevos: extender aquí si hace falta.
 */
export const brand = {
  indigo: '#3B34D0',
  indigoLight: '#6C64FF',
  indigoDeep: '#251CB8',
  black: '#08090B',
  cyan: '#47CFCB',
  magenta: '#DA6997',
  white: '#FFFFFF',
} as const;

export type ThemeColors = {
  bg: string;
  bgRaised: string;
  bgRaised2: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  line: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  success: string;
  danger: string;
  warning: string;
};

// Paleta derivada de web/index.html (variables --bg, --ink, --line…)
export const darkColors: ThemeColors = {
  bg: '#07080B',
  bgRaised: '#101218',
  bgRaised2: '#16181F',
  ink: '#FFFFFF',
  inkSoft: '#AFB2BE',
  inkFaint: '#6F7280',
  line: '#212330',
  primary: brand.indigo,
  primaryPressed: brand.indigoDeep,
  onPrimary: '#FFFFFF',
  success: brand.cyan,
  danger: brand.magenta,
  warning: '#F3B341',
};

export const lightColors: ThemeColors = {
  bg: '#F4F4F8',
  bgRaised: '#FFFFFF',
  bgRaised2: '#ECEDF4',
  ink: '#101116',
  inkSoft: '#4B4E5A',
  inkFaint: '#83869A',
  line: '#DDDFE9',
  primary: brand.indigo,
  primaryPressed: brand.indigoDeep,
  onPrimary: '#FFFFFF',
  success: '#1F8E8A',
  danger: '#B8416F',
  warning: '#B7791F',
};

export const fonts = {
  heading: 'Poppins_700Bold',
  headingHeavy: 'Poppins_800ExtraBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 8, lg: 14, xl: 22, pill: 999 } as const;
