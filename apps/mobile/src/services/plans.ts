import { unwrap } from '../lib/errors';
import { supabase } from '../lib/supabase';
import type { MyPlan, Plan, PlanTier } from '../types/database';

export async function listPlans(): Promise<Plan[]> {
  return unwrap(await supabase.from('plans').select('*').eq('is_public', true).order('sort_order'));
}

export async function getMyPlan(): Promise<MyPlan> {
  return unwrap(await supabase.rpc('my_plan')) as unknown as MyPlan;
}

/** Prueba gratis de 7 días (una por usuario). */
export async function startTrial(tier: Exclude<PlanTier, 'free'>): Promise<MyPlan> {
  return unwrap(await supabase.rpc('start_trial', { p_tier: tier })) as unknown as MyPlan;
}

export const PLAN_LABEL: Record<PlanTier, string> = {
  free: 'Gratis',
  individual: 'Individual',
  pareja: 'Pareja',
  familiar: 'Familiar',
};
