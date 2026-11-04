import { Stack } from 'expo-router';

import { useNotificationRouting } from '../../hooks/useNotificationRouting';
import { fonts, useThemeColors } from '../../theme';

export default function AppLayout() {
  const c = useThemeColors();
  useNotificationRouting();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.ink,
        headerTitleStyle: { fontFamily: fonts.heading },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="blocked" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
      <Stack.Screen name="request/[id]" options={{ title: 'Petición' }} />
      <Stack.Screen name="rules/new" options={{ title: 'Nuevo límite', presentation: 'modal' }} />
      <Stack.Screen name="rules/[id]" options={{ title: 'Límite' }} />
    </Stack>
  );
}
