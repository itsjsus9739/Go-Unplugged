import { unwrap } from '../lib/errors';
import { supabase } from '../lib/supabase';
import type { InvitationRole, Partnership, Profile } from '../types/database';

export type PartnershipWithPeople = Partnership & {
  monitored: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null;
  partner: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null;
};

export async function createInvitation(role: InvitationRole = 'monitored') {
  return unwrap(await supabase.rpc('create_invitation', { p_inviter_role: role }));
}

export async function acceptInvitation(code: string) {
  return unwrap(await supabase.rpc('accept_invitation', { p_code: code }));
}

export async function listMyPendingInvitations(userId: string) {
  return unwrap(
    await supabase
      .from('partner_invitations')
      .select('*')
      .eq('inviter_id', userId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  );
}

export async function cancelInvitation(id: string) {
  unwrap(await supabase.from('partner_invitations').update({ status: 'revoked' }).eq('id', id).select('id'));
}

/** Relaciones donde participo (como monitoreado o como socio), con los perfiles de ambos lados. */
export async function listPartnerships(): Promise<PartnershipWithPeople[]> {
  const rows = unwrap(
    await supabase
      .from('partnerships')
      .select('*')
      .neq('status', 'revoked')
      .order('created_at', { ascending: true }),
  );
  const ids = [...new Set(rows.flatMap((r) => [r.monitored_id, r.partner_id]))];
  const people = ids.length
    ? unwrap(await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids))
    : [];
  const byId = new Map(people.map((p) => [p.id, p]));
  return rows.map((r) => ({
    ...r,
    monitored: byId.get(r.monitored_id) ?? null,
    partner: byId.get(r.partner_id) ?? null,
  }));
}

export async function revokePartnership(id: string) {
  return unwrap(await supabase.rpc('revoke_partnership', { p_partnership_id: id }));
}

export async function setPartnerPin(partnershipId: string, pin: string) {
  const { error } = await supabase.rpc('set_partner_pin', { p_partnership_id: partnershipId, p_pin: pin });
  if (error) throw error;
}

export async function verifyPartnerPin(pin: string, deviceId?: string) {
  return unwrap(await supabase.rpc('verify_partner_pin', { p_pin: pin, p_device_id: deviceId }));
}
