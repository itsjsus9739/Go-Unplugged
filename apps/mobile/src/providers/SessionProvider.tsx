import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useRealtime } from '../hooks/useRealtime';
import { isSupabaseConfigured } from '../lib/env';
import { supabase } from '../lib/supabase';
import { pushUsageAndEvents, syncBlocking } from '../services/blockingSync';
import { registerThisDevice } from '../services/devices';
import { setupNotificationChannels } from '../services/notifications';
import { getMyProfile } from '../services/profile';
import { listRules } from '../services/rules';
import type { Device, Profile } from '../types/database';

type SessionState = {
  ready: boolean;
  session: Session | null;
  userId: string | null;
  profile: Profile | null;
  device: Device | null;
  refreshProfile: () => Promise<void>;
  /** Re-sincroniza reglas + desbloqueos con el bloqueador nativo. */
  resync: () => Promise<void>;
};

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setProfile(null);
        setDevice(null);
      }
    });
    setupNotificationChannels().catch(() => undefined);
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (userId) setProfile(await getMyProfile(userId));
  }, [userId]);

  const resync = useCallback(async () => {
    if (!userId) return;
    try {
      await syncBlocking(userId);
      const rules = await listRules(userId);
      await pushUsageAndEvents(userId, device, rules);
    } catch (e) {
      console.warn('[sync]', e);
    }
  }, [userId, device]);

  // Al iniciar sesión: perfil + registro del dispositivo + primera sincronización.
  useEffect(() => {
    if (!userId) return;
    getMyProfile(userId)
      .then(setProfile)
      .catch((e) => console.warn('[profile]', e));
    registerThisDevice(userId)
      .then(setDevice)
      .catch((e) => console.warn('[device]', e));
  }, [userId]);

  useEffect(() => {
    resync();
  }, [resync]);

  // Al volver a primer plano, re-sincroniza (reemplaza el botón "Sincronizar permisos").
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && resync());
    return () => sub.remove();
  }, [resync]);

  // En vivo: aprobaciones del socio o cambios de reglas hechos por él.
  useRealtime('extension_requests', resync, userId ? `requester_id=eq.${userId}` : undefined, !!userId);
  useRealtime('limit_rules', resync, userId ? `user_id=eq.${userId}` : undefined, !!userId);
  useRealtime('rule_targets', resync, userId ? `user_id=eq.${userId}` : undefined, !!userId);

  const value = useMemo(
    () => ({ ready, session, userId, profile, device, refreshProfile, resync }),
    [ready, session, userId, profile, device, refreshProfile, resync],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession debe usarse dentro de <SessionProvider>');
  return v;
}

/** Igual que useSession pero garantiza usuario autenticado (pantallas protegidas). */
export function useAuthed() {
  const s = useSession();
  if (!s.userId) throw new Error('Pantalla protegida sin sesión');
  return s as SessionState & { userId: string };
}
