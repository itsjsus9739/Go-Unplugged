import { Platform } from 'react-native';

import { AppBlocker, type BlockingConfig } from '../../modules/app-blocker';
import { hhmm, todayISODate } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { ActiveGrant, Device } from '../types/database';
import { reportDeviceEvent } from './devices';
import { listActiveGrants } from './requests';
import { listRules, type RuleWithTargets } from './rules';

/**
 * Equivalente a `GoUnplugged.sincronizar_autorizacion()` del prototipo:
 * baja reglas + desbloqueos vigentes de Supabase y se los pasa al bloqueador nativo.
 */
export function buildBlockingConfig(
  rules: RuleWithTargets[],
  grants: ActiveGrant[],
  protectionEnabled = true,
): BlockingConfig {
  const os = Platform.OS === 'ios' ? 'ios' : 'android';
  return {
    protectionEnabled,
    rules: rules.map((r) => ({
      id: r.id,
      identifiers: r.rule_targets
        .filter((t) => t.platform === null || t.platform === os)
        .map((t) => t.identifier),
      dailyLimitMinutes: r.daily_limit_minutes,
      activeDays: r.active_days,
      blockStart: hhmm(r.block_start),
      blockEnd: hhmm(r.block_end),
      isActive: r.is_active,
    })),
    grants: grants
      .filter((g) => g.grant_ends_at)
      .map((g) => ({
        ruleId: g.rule_id,
        identifier: g.target_identifier,
        endsAt: new Date(g.grant_ends_at as string).getTime(),
      })),
  };
}

export async function syncBlocking(userId: string): Promise<BlockingConfig> {
  const [rules, grants] = await Promise.all([listRules(userId), listActiveGrants(userId)]);
  const config = buildBlockingConfig(rules, grants);
  await AppBlocker.setConfig(config);
  return config;
}

/** Sube los minutos de hoy (Android) y reporta los bloqueos ocurridos offline. */
export async function pushUsageAndEvents(userId: string, device: Device | null, rules: RuleWithTargets[]) {
  if (!device) return;

  const events = AppBlocker.consumeBlockEvents();
  for (const e of events) {
    await reportDeviceEvent(userId, device.id, 'limit_reached', e).catch(() => undefined);
  }

  if (Platform.OS !== 'android') return; // iOS: el uso lo muestra un DeviceActivityReport
  const names = new Map(rules.flatMap((r) => r.rule_targets.map((t) => [t.identifier, t.display_name] as const)));
  const usage = await AppBlocker.getUsageToday([...names.keys()]);
  const date = todayISODate();
  const rows = Object.entries(usage).map(([identifier, minutes]) => ({
    device_id: device.id,
    user_id: userId,
    usage_date: date,
    identifier,
    display_name: names.get(identifier) ?? null,
    minutes_used: Math.min(1440, minutes),
  }));
  if (rows.length) {
    const { error } = await supabase.from('usage_daily').upsert(rows, { onConflict: 'device_id,usage_date,identifier' });
    if (error) throw error;
  }
}
