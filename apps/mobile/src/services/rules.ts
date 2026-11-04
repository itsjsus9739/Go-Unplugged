import { errorCode, unwrap } from '../lib/errors';
import { supabase } from '../lib/supabase';
import type { LimitRule, Platform, RuleTarget } from '../types/database';
import { requestExtension } from './requests';

export type RuleWithTargets = LimitRule & { rule_targets: RuleTarget[] };

export async function listRules(userId: string): Promise<RuleWithTargets[]> {
  return unwrap(
    await supabase
      .from('limit_rules')
      .select('*, rule_targets(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
  ) as unknown as RuleWithTargets[];
}

export async function createRule(input: {
  userId: string;
  name: string;
  dailyLimitMinutes: number;
  activeDays?: number[];
  blockStart?: string | null;
  blockEnd?: string | null;
}): Promise<LimitRule> {
  return unwrap(
    await supabase
      .from('limit_rules')
      .insert({
        user_id: input.userId,
        name: input.name,
        daily_limit_minutes: input.dailyLimitMinutes,
        active_days: input.activeDays ?? [1, 2, 3, 4, 5, 6, 7],
        block_start: input.blockStart ?? null,
        block_end: input.blockEnd ?? null,
      })
      .select('*')
      .single(),
  );
}

export type RulePatch = Partial<
  Pick<LimitRule, 'daily_limit_minutes' | 'is_active' | 'active_days' | 'block_start' | 'block_end' | 'name'>
>;

/**
 * Endurecer un límite se aplica al instante. Si el cambio lo afloja y hay socio,
 * la base de datos lo rechaza (rule_relax_requires_partner) y aquí se convierte
 * automáticamente en una petición para el socio.
 */
export async function updateRuleOrRequest(
  ruleId: string,
  patch: RulePatch,
  reason?: string,
): Promise<{ applied: true } | { applied: false; requestId: string }> {
  const { error } = await supabase.from('limit_rules').update(patch).eq('id', ruleId);
  if (!error) return { applied: true };
  if (errorCode(error) !== 'rule_relax_requires_partner') throw error;

  const { name: _ignored, ...payload } = patch;
  const req = await requestExtension({ kind: 'rule_relax', ruleId, payload, reason });
  return { applied: false, requestId: req.id };
}

export async function deleteRuleOrRequest(ruleId: string, reason?: string) {
  const { error } = await supabase.from('limit_rules').delete().eq('id', ruleId);
  if (!error) return { applied: true as const };
  if (errorCode(error) !== 'rule_relax_requires_partner') throw error;
  const req = await requestExtension({ kind: 'rule_relax', ruleId, payload: { delete_rule: true }, reason });
  return { applied: false as const, requestId: req.id };
}

export async function addTarget(input: {
  ruleId: string;
  userId: string;
  platform: Platform | null;
  identifier: string;
  displayName: string;
  deviceId?: string | null;
}): Promise<RuleTarget> {
  return unwrap(
    await supabase
      .from('rule_targets')
      .upsert(
        {
          rule_id: input.ruleId,
          user_id: input.userId,
          platform: input.platform,
          identifier: input.identifier,
          display_name: input.displayName,
          device_id: input.deviceId ?? null,
        },
        { onConflict: 'rule_id,platform,identifier' },
      )
      .select('*')
      .single(),
  );
}

export async function removeTargetOrRequest(target: RuleTarget, reason?: string) {
  const { error } = await supabase.from('rule_targets').delete().eq('id', target.id);
  if (!error) return { applied: true as const };
  if (errorCode(error) !== 'rule_relax_requires_partner') throw error;
  const req = await requestExtension({
    kind: 'rule_relax',
    ruleId: target.rule_id,
    payload: { remove_target_ids: [target.id] },
    targetIdentifier: target.identifier,
    targetName: target.display_name,
    reason,
  });
  return { applied: false as const, requestId: req.id };
}

export async function getRule(ruleId: string): Promise<RuleWithTargets> {
  return unwrap(
    await supabase.from('limit_rules').select('*, rule_targets(*)').eq('id', ruleId).single(),
  ) as unknown as RuleWithTargets;
}
