import { unwrap } from '../lib/errors';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

export async function getMyProfile(userId: string): Promise<Profile> {
  return unwrap(await supabase.from('profiles').select('*').eq('id', userId).single());
}

export async function updateMyProfile(
  userId: string,
  patch: Partial<Pick<Profile, 'display_name' | 'avatar_url' | 'timezone' | 'onboarding_completed' | 'emergency_unlocks_per_month' | 'emergency_unlock_minutes'>>,
): Promise<Profile> {
  return unwrap(await supabase.from('profiles').update(patch).eq('id', userId).select('*').single());
}
