import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Canales Android + categoría con botones (Aprobar / Denegar) para el socio. */
export async function setupNotificationChannels() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: AndroidImportance.DEFAULT,
      lightColor: '#3B34D0',
    });
    await Notifications.setNotificationChannelAsync('requests', {
      name: 'Peticiones de tiempo',
      importance: AndroidImportance.HIGH,
      lightColor: '#3B34D0',
      vibrationPattern: [0, 200, 120, 200],
    });
  }
  await Notifications.setNotificationCategoryAsync('extension_request', [
    { identifier: 'approve', buttonTitle: 'Aprobar', options: { opensAppToForeground: true } },
    { identifier: 'deny', buttonTitle: 'Denegar', options: { opensAppToForeground: true, isDestructive: true } },
  ]);
}

/** Devuelve el Expo push token o null (simulador, permiso denegado o sin projectId de EAS). */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return null;

  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('[push] Falta extra.eas.projectId: ejecuta `npx eas-cli init` para obtener push tokens.');
    return null;
  }
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}
