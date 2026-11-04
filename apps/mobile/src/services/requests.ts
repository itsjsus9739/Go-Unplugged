import { unwrap } from '../lib/errors';
import { supabase } from '../lib/supabase';
import type { ActiveGrant, ExtensionRequest, Json, RequestKind } from '../types/database';

export async function requestExtension(input: {
  kind?: RequestKind;
  minutes?: number;
  reason?: string;
  ruleId?: string;
  targetIdentifier?: string;
  targetName?: string;
  deviceId?: string;
  payload?: Json;
}): Promise<ExtensionRequest> {
  return unwrap(
    await supabase.rpc('request_extension', {
      p_kind: input.kind ?? 'time_extension',
      p_minutes: input.minutes,
      p_reason: input.reason || undefined,
      p_rule_id: input.ruleId,
      p_target_identifier: input.targetIdentifier,
      p_target_name: input.targetName,
      p_device_id: input.deviceId,
      p_payload: input.payload ?? {},
    }),
  );
}

export async function decideRequest(requestId: string, approve: boolean, minutesGranted?: number, note?: string) {
  return unwrap(
    await supabase.rpc('decide_request', {
      p_request_id: requestId,
      p_approve: approve,
      p_minutes_granted: minutesGranted,
      p_note: note || undefined,
    }),
  );
}

export async function cancelRequest(requestId: string) {
  return unwrap(await supabase.rpc('cancel_request', { p_request_id: requestId }));
}

export async function getRequest(id: string): Promise<ExtensionRequest> {
  return unwrap(await supabase.from('extension_requests').select('*').eq('id', id).single());
}

/** Historial propio (lo que pedí). */
export async function listMyRequests(userId: string, limit = 30): Promise<ExtensionRequest[]> {
  return unwrap(
    await supabase
      .from('extension_requests')
      .select('*')
      .eq('requester_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
  );
}

/** Peticiones de las personas que superviso (RLS ya filtra por relación). */
export async function listRequestsToDecide(userId: string, onlyPending = true): Promise<ExtensionRequest[]> {
  let q = supabase
    .from('extension_requests')
    .select('*')
    .neq('requester_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (onlyPending) q = q.eq('status', 'pending').gt('expires_at', new Date().toISOString());
  return unwrap(await q);
}

export async function listActiveGrants(userId: string): Promise<ActiveGrant[]> {
  return unwrap(await supabase.from('active_grants').select('*').eq('requester_id', userId));
}
