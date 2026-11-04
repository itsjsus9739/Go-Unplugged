import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type {
  AppBlockerNativeModule,
  BlockEvent,
  BlockerPermissions,
  BlockingConfig,
  LaunchableApp,
  PickerResult,
} from './src/AppBlocker.types';

export * from './src/AppBlocker.types';

const native = requireOptionalNativeModule<AppBlockerNativeModule>('AppBlocker');

/**
 * `true` cuando corre en un development build / APK / IPA con el módulo compilado.
 * En Expo Go o web el módulo no existe y se usa un simulador en memoria para
 * poder desarrollar la UI y el flujo con Supabase.
 */
export const isNativeBlockerAvailable = native !== null;

let mockConfig: string | null = null;
const MOCK_APPS: LaunchableApp[] = [
  { identifier: 'com.instagram.android', name: 'Instagram' },
  { identifier: 'com.zhiliaoapp.musically', name: 'TikTok' },
  { identifier: 'com.twitter.android', name: 'X' },
  { identifier: 'com.facebook.katana', name: 'Facebook' },
  { identifier: 'com.google.android.youtube', name: 'YouTube' },
  { identifier: 'com.whatsapp', name: 'WhatsApp' },
];

export const AppBlocker = {
  platform: (native?.platform ?? Platform.OS) as 'android' | 'ios' | string,

  getPermissions(): Promise<BlockerPermissions> {
    return native
      ? native.getPermissionsAsync()
      : Promise.resolve({ usageAccess: false, accessibilityService: false, familyControls: 'unsupported' });
  },

  requestAuthorization(): Promise<boolean> {
    return native ? native.requestAuthorizationAsync() : Promise.resolve(false);
  },

  openUsageAccessSettings() {
    native?.openUsageAccessSettings();
  },

  openAccessibilitySettings() {
    native?.openAccessibilitySettings();
  },

  getLaunchableApps(): Promise<LaunchableApp[]> {
    return native ? native.getLaunchableAppsAsync() : Promise.resolve(MOCK_APPS);
  },

  getUsageToday(identifiers?: string[]): Promise<Record<string, number>> {
    return native ? native.getUsageTodayAsync(identifiers) : Promise.resolve({});
  },

  /** iOS: abre FamilyActivityPicker para la regla indicada. */
  presentAppPicker(ruleId: string): Promise<PickerResult> {
    return native ? native.presentAppPickerAsync(ruleId) : Promise.resolve(null);
  },

  async setConfig(config: BlockingConfig): Promise<void> {
    const json = JSON.stringify(config);
    if (native) await native.setConfigAsync(json);
    else mockConfig = json;
  },

  getConfig(): BlockingConfig | null {
    const raw = native ? native.getConfig() : mockConfig;
    return raw ? (JSON.parse(raw) as BlockingConfig) : null;
  },

  consumeBlockEvents(): BlockEvent[] {
    if (!native) return [];
    try {
      return JSON.parse(native.consumeBlockEvents()) as BlockEvent[];
    } catch {
      return [];
    }
  },
};
