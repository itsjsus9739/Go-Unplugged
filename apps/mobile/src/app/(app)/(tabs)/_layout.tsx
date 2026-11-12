import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { fonts, useThemeColors } from '../../../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const c = useThemeColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: c.bgRaised, borderTopColor: c.line },
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.inkFaint,
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Hoy', tabBarIcon: icon('time-outline') }} />
      <Tabs.Screen name="limits" options={{ title: 'Límites', tabBarIcon: icon('lock-closed-outline') }} />
      <Tabs.Screen name="partner" options={{ title: 'Acuerdo', tabBarIcon: icon('people-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Cuenta', tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
