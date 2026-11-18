import { useEffect, useRef } from 'react';

import { supabase } from '../lib/supabase';

type Table = 'extension_requests' | 'notifications' | 'partnerships' | 'limit_rules' | 'rule_targets';

/**
 * Escucha cambios (INSERT/UPDATE/DELETE) en una tabla vía Supabase Realtime.
 * RLS se aplica: solo llegan filas que el usuario puede ver.
 */
export function useRealtime(table: Table, onChange: () => void, filter?: string, enabled = true) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`rt:${table}:${filter ?? 'all'}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => cb.current());
    // Supabase Realtime no aplica filtros a los DELETE (solo envía la clave primaria):
    // se escuchan sin filtro y se recarga; RLS sigue protegiendo los datos al recargar.
    if (filter) channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, () => cb.current());
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, enabled]);
}
