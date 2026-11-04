import { Link, router } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RequestCard } from '../../../components/RequestCard';
import { Badge, Body, Button, Card, Eyebrow, Heading, Row, Title } from '../../../components/ui';
import { useAsync } from '../../../hooks/useAsync';
import { useRealtime } from '../../../hooks/useRealtime';
import { formatMinutes, minutesLeft, todayISODate } from '../../../lib/format';
import { supabase } from '../../../lib/supabase';
import { useAuthed } from '../../../providers/SessionProvider';
import { listPartnerships } from '../../../services/partnerships';
import { listActiveGrants, listMyRequests, listRequestsToDecide } from '../../../services/requests';
import { listRules } from '../../../services/rules';
import { space, useThemeColors } from '../../../theme';

export default function Today() {
  const { userId, profile, device } = useAuthed();
  const c = useThemeColors();

  const { data, loading, reload } = useAsync(async () => {
    const [rules, grants, mine, toDecide, partnerships, usage] = await Promise.all([
      listRules(userId),
      listActiveGrants(userId),
      listMyRequests(userId, 5),
      listRequestsToDecide(userId),
      listPartnerships(),
      supabase.from('usage_daily').select('identifier, minutes_used').eq('user_id', userId).eq('usage_date', todayISODate()),
    ]);
    const usedBy = new Map((usage.data ?? []).map((u) => [u.identifier, u.minutes_used]));
    return { rules, grants, mine, toDecide, partnerships, usedBy };
  }, [userId]);

  useRealtime('extension_requests', reload);
  useRealtime('partnerships', reload);

  const myPartners = data?.partnerships.filter((p) => p.monitored_id === userId) ?? [];
  const pendingMine = data?.mine.filter((r) => r.status === 'pending') ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.primary} />}
      >
        <View style={{ gap: space.xs }}>
          <Eyebrow>Hola, {profile?.display_name || 'de nuevo'}</Eyebrow>
          <Title>Tu tiempo de hoy</Title>
        </View>

        <Card accent>
          <Row style={{ justifyContent: 'space-between' }}>
            <Eyebrow color="rgba(255,255,255,0.78)">Estado</Eyebrow>
            <Badge label={device?.protection_enabled ? 'Protección activa' : 'Protección inactiva'} tone={device?.protection_enabled ? 'success' : 'warning'} />
          </Row>
          <Heading style={{ color: '#fff' }}>
            {myPartners.length
              ? `Tu socio: ${myPartners.map((p) => p.partner?.display_name).join(', ')}`
              : 'Aún no tienes socio de confianza'}
          </Heading>
          {!myPartners.length && (
            <Link href="/partner" asChild>
              <Button title="Invitar a mi socio" variant="secondary" />
            </Link>
          )}
        </Card>

        {data?.toDecide.length ? (
          <Card>
            <Heading>Tienes {data.toDecide.length} petición(es) por decidir</Heading>
            <Button title="Revisar" onPress={() => router.push('/partner')} />
          </Card>
        ) : null}

        {data?.grants.map((g) => (
          <Card key={g.id}>
            <Eyebrow>Tiempo aprobado</Eyebrow>
            <Heading>
              {g.target_name ?? 'Todas las apps'} · quedan {minutesLeft(g.grant_ends_at!)} min
            </Heading>
          </Card>
        ))}

        <Heading>Límites</Heading>
        {data?.rules.length === 0 && (
          <Card>
            <Body muted>Todavía no tienes límites. Crea el primero y elige qué apps entran.</Body>
            <Button title="Crear límite" onPress={() => router.push('/rules/new')} />
          </Card>
        )}
        {data?.rules.map((r) => {
          const used = r.rule_targets.reduce((acc, t) => acc + (data.usedBy.get(t.identifier) ?? 0), 0);
          const pct = r.daily_limit_minutes ? Math.min(1, used / r.daily_limit_minutes) : 1;
          return (
            <Card key={r.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Heading>{r.name}</Heading>
                {!r.is_active && <Badge label="Pausado" />}
              </Row>
              <Body muted>
                {formatMinutes(used)} de {formatMinutes(r.daily_limit_minutes)} · {r.rule_targets.map((t) => t.display_name).join(', ') || 'sin apps'}
              </Body>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: c.bgRaised2, overflow: 'hidden' }}>
                <View style={{ width: `${pct * 100}%`, height: 8, backgroundColor: pct >= 1 ? c.danger : c.primary }} />
              </View>
            </Card>
          );
        })}

        {pendingMine.length > 0 && <Heading>Esperando a tu socio</Heading>}
        {pendingMine.map((r) => (
          <RequestCard key={r.id} request={r} />
        ))}

        {myPartners.length > 0 && (
          <View style={{ gap: space.md }}>
            <Button title="Pedir tiempo extra" variant="secondary" onPress={() => router.push('/blocked')} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
