/** Formato compartido JS ↔ nativo (Kotlin BlockingConfig.kt / Swift SharedStore.swift). */
export type BlockingRule = {
  id: string;
  /** Android: package names. iOS: se ignora (los tokens viven en el App Group por regla). */
  identifiers: string[];
  dailyLimitMinutes: number;
  /** ISO: 1 = lunes … 7 = domingo */
  activeDays: number[];
  /** "HH:MM" o null */
  blockStart: string | null;
  blockEnd: string | null;
  isActive: boolean;
};

export type BlockingGrant = {
  ruleId: string | null;
  identifier: string | null;
  /** epoch en milisegundos */
  endsAt: number;
};

export type BlockingConfig = {
  protectionEnabled: boolean;
  rules: BlockingRule[];
  grants: BlockingGrant[];
};

export type BlockerPermissions = {
  /** Android: Acceso a datos de uso */
  usageAccess: boolean;
  /** Android: servicio de accesibilidad activo */
  accessibilityService: boolean;
  /** iOS: autorización de Screen Time (FamilyControls) */
  familyControls: 'approved' | 'denied' | 'notDetermined' | 'unsupported';
};

export type LaunchableApp = { identifier: string; name: string };

export type PickerResult = { applications: number; categories: number; webDomains: number } | null;

export type BlockEvent = {
  type: 'limit_reached';
  identifier: string;
  ruleId: string;
  reason: 'daily_limit' | 'block_window';
  at: number;
};

export interface AppBlockerNativeModule {
  readonly platform: 'android' | 'ios';
  getPermissionsAsync(): Promise<BlockerPermissions>;
  requestAuthorizationAsync(): Promise<boolean>;
  openUsageAccessSettings(): void;
  openAccessibilitySettings(): void;
  getLaunchableAppsAsync(): Promise<LaunchableApp[]>;
  /** minutos por identificador desde la medianoche (solo Android) */
  getUsageTodayAsync(identifiers?: string[]): Promise<Record<string, number>>;
  presentAppPickerAsync(ruleId: string): Promise<PickerResult>;
  setConfigAsync(json: string): Promise<boolean>;
  getConfig(): string | null;
  consumeBlockEvents(): string;
}
