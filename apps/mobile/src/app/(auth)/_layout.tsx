import { Stack } from 'expo-router';

import { useThemeColors } from '../../theme';

export default function AuthLayout() {
  const c = useThemeColors();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
}
