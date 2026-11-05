import { router } from 'expo-router';

import { Body, ListRow, Screen, Section, TextLink } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { useReloadOnFocus } from '../../hooks/useReloadOnFocus';
import { timeAgo } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { unwrap } from '../../lib/errors';
import { useAuthed } from '../../providers/SessionProvider';
import { getMyPlan } from '../../services/plans';
import { brand, useThemeColors } from '../../theme';
import type { RequestStatus } from '../../types/database';

const STATUS: Record<RequestStatus, string> = {
  pending: 'Esperando',
  approved: 'Aprobada',
  denied: 'No',
  expired: 'Expiró',
  cancelled: 'Cancelada',
};

/** Historial de peticiones (propias y de quienes acompaño). Gratis: últimos 7 días. */
export default function History() {
  const { userId } = useAuthed();
  const c = useThemeColors();
  const { data, reload } = useAsync(async () => {
    const mine = await getMyPlan();
    const days = mine.plan.history_days;
    let q = supabase.from('extension_requests').select('*').order('created_at', { ascending: false }).limit(100);
    if (days) q = q.gte('created_at', new Date(Date.now() - days * 864e5).toISOString());
    return { rows: unwrap(await q), days };
  }, [userId]);
  useReloadOnFocus(reload);

  const color = (s: RequestStatus) => (s === 'approved' ? brand.cyan : s === 'denied' ? brand.magenta : c.inkSoft);

  return (
    <Screen>
      {data?.days ? (
        <Body muted>
          Tu plan muestra los últimos {data.days} días. <TextLink title="Ver planes" onPress={() => router.push('/plans')} />
        </Body>
      ) : null}
      <Section title="Peticiones">
        {data?.rows.length === 0 && <Body muted>Todavía no hay peticiones.</Body>}
        {data?.rows.map((r) => (
          <ListRow
            key={r.id}
            title={`${r.target_name ?? 'Todas las apps'}${r.minutes_requested ? ` · ${r.minutes_requested} min` : ''}`}
            subtitle={`${r.requester_id === userId ? 'Pediste' : 'Te pidieron'} · ${timeAgo(r.created_at)}${r.reason ? ` · “${r.reason}”` : ''}`}
            right={STATUS[r.status]}
            rightColor={color(r.status)}
            onPress={() => router.push({ pathname: '/request/[id]', params: { id: r.id } })}
          />
        ))}
      </Section>
    </Screen>
  );
}
