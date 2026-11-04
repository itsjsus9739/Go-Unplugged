import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { AppBlocker } from '../../modules/app-blocker';
import { unwrap } from '../lib/errors';
import { supabase } from '../lib/supabase';
import type { Device as DeviceRow, DeviceEventType, Json } from '../types/database';
import { registerForPushNotifications } from './notifications';

const INSTALL_ID_KEY = 'gounplugged.install_id';

async function getInstallId(): Promise<string> {
  let id = await SecureStore.getItemAsync(INSTALL_ID_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync(INSTALL_ID_KEY, id);
  }
  return id;
}

/** Registra/actualiza este teléfono en `devices` (push token, permisos, versión). */
export async function registerThisDevice(userId: string): Promise<DeviceRow | null> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;

  const [installId, pushToken, permissions] = await Promise.all([
    getInstallId(),
    registerForPushNotifications().catch(() => null),
    AppBlocker.getPermissions().catch(() => null),
  ]);

  const protectionEnabled =
    Platform.OS === 'android'
      ? !!permissions?.accessibilityService && !!permissions?.usageAccess
      : permissions?.familyControls === 'approved';

  return unwrap(
    await supabase
      .from('devices')
      .upsert(
        {
          user_id: userId,
          install_id: installId,
          platform: Platform.OS,
          name: Device.deviceName ?? null,
          model: Device.modelName ?? null,
          os_version: Device.osVersion ?? null,
          app_version: Application.nativeApplicationVersion ?? null,
          push_token: pushToken,
          protection_enabled: protectionEnabled,
          permissions: (permissions ?? {}) as Json,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,install_id' },
      )
      .select('*')
      .single(),
  );
}

export async function reportDeviceEvent(
  userId: string,
  deviceId: string | null,
  type: Exclude<DeviceEventType, 'pin_verified' | 'pin_failed'>,
  data: Json = {},
) {
  const { error } = await supabase.from('device_events').insert({ user_id: userId, device_id: deviceId, type, data });
  if (error) throw error;
}

export async function listDevicesOf(userId: string): Promise<DeviceRow[]> {
  return unwrap(await supabase.from('devices').select('*').eq('user_id', userId).order('last_seen_at', { ascending: false }));
}
