import { router } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, BigNumber, ListRow, Section, StatusDot, TextLink } from '../../../components/ui';
import { useAsync } from '../../../hooks/useAsync';
import { useReloadOnFocus } from '../../../hooks/useReloadOnFocus';
import { useNow } from '../../../hooks/useNow';
import { useRealtime } from '../../../hooks/useRealtime';
import { clock, formatMinutes, shortDate, timeAgo, todayISODate } from '../../../lib/format';
import { supabase } from '../../../lib/supabase';
import { useAuthed } from '../../../providers/SessionProvider';
import { listPartnerships } from '../../../services/partnerships';
import { listActiveGrants, listMyRequests, listRequestsToDecide } from '../../../services/requests';
import { listRules } from '../../../services/rules';
import { brand, fonts, space, useThemeColors } from '../../../theme';

export default function Today() {
  const { userId, profile, device } = useAuthed();
  const c = useThemeColors();
  const now = useNow();

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
  useReloadOnFocus(reload);

  useRealtime('extension_requests', reload);
  useRealtime('partnerships', reload);

  const partners = data?.partnerships.filter((p) => p.monitored_id === userId) ?? [];
  const supervised = data?.partnerships.filter((p) => p.partner_id === userId) ?? [];
  const partnerName = partners[0]?.partner?.display_name;
  const pending = data?.mine.filter((r) => r.status === 'pending') ?? [];
  const rules = data?.rules ?? [];
  const usedOf = (r: (typeof rules)[number]) => r.rule_targets.reduce((a, t) => a + (data?.usedBy.get(t.identifier) ?? 0), 0);
  const totalUsed = rules.reduce((a, r) => a + usedOf(r), 0);
  const totalLimit = rules.reduce((a, r) => a + r.daily_limit_minutes, 0);
  const nameOf = (id: string) => data?.partnerships.find((p) => p.monitored_id === id)?.monitored?.display_name ?? 'Alguien';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xxl, gap: space.xxl }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.primary} />}
      >
        <View style={{ gap: space.xs }}>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: c.inkFaint }}>
            {shortDate()} · {profile?.display_name}
          </Text>

          {rules.length > 0 ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.sm }}>
                <BigNumber size={64}>{totalUsed}</BigNumber>
                <Text style={{ fontFamily: fonts.heading, fontSize: 22, color: c.inkSoft, marginBottom: 12 }}>min</Text>
              </View>
              <Body muted>
                de {formatMinutes(totalLimit)} que acordaste para hoy
                {totalUsed > totalLimit ? ' — ya te pasaste.' : '.'}
              </Body>
            </>
          ) : (
            <Text style={{ fontFamily: fonts.heading, fontSize: 30, lineHeight: 36, color: c.ink, marginTop: space.sm }}>
              {supervised.length ? `Acompañas a ${supervised.map((p) => p.monitored?.display_name).join(' y ')}.` : 'Aún no tienes límites.'}
            </Text>
          )}

          <View style={{ marginTop: space.md }}>
            {partnerName ? (
              <StatusDot
                label={`${partnerName} tiene la llave${device?.protection_enabled ? '' : ' · falta activar el bloqueo'}`}
                color={device?.protection_enabled ? brand.cyan : c.warning}
              />
            ) : supervised.length === 0 ? (
              <TextLink title="Elige a tu socio de confianza →" onPress={() => router.push('/partner')} />
            ) : null}
          </View>
        </View>

        {data?.toDecide.length ? (
          <Section title="Te piden tiempo">
            {data.toDecide.map((r) => (
              <ListRow
                key={r.id}
                title={`${nameOf(r.requester_id)} · ${r.target_name ?? 'Todas las apps'}`}
                subtitle={`${r.minutes_requested ? `${r.minutes_requested} min más · ` : ''}${timeAgo(r.created_at)}`}
                chevron
                onPress={() => router.push({ pathname: '/request/[id]', params: { id: r.id } })}
              />
            ))}
          </Section>
        ) : null}

        {data?.grants.length ? (
          <Section title="Tiempo extra corriendo">
            {data.grants.map((g) => (
              <ListRow
                key={g.id}
                title={g.target_name ?? 'Todas las apps'}
                subtitle={g.kind === 'emergency' ? 'Desbloqueo de urgencia' : `Aprobado por ${partnerName ?? 'tu socio'}`}
                right={clock(new Date(g.grant_ends_at!).getTime() - now)}
                rightColor={brand.cyan}
              />
            ))}
          </Section>
        ) : null}

        {rules.length > 0 && (
          <Section title="Límites de hoy" action={<TextLink title="Editar" onPress={() => router.push('/limits')} />}>
            {rules.map((r) => {
              const used = usedOf(r);
              const over = used >= r.daily_limit_minutes;
              const pct = r.daily_limit_minutes ? Math.min(1, used / r.daily_limit_minutes) : 1;
              return (
                <ListRow
                  key={r.id}
                  title={r.name}
                  subtitle={r.rule_targets.map((t) => t.display_name).join(', ') || 'Sin apps'}
                  right={`${used} / ${r.daily_limit_minutes}`}
                  rightColor={over ? brand.magenta : c.inkSoft}
                  onPress={() => router.push({ pathname: '/rules/[id]', params: { id: r.id } })}
                >
                  <View style={{ height: 3, backgroundColor: c.bgRaised2, borderRadius: 2 }}>
                    <View style={{ width: `${pct * 100}%`, height: 3, borderRadius: 2, backgroundColor: over ? brand.magenta : c.primary }} />
                  </View>
                </ListRow>
              );
            })}
          </Section>
        )}

        {pending.length > 0 && (
          <Section title={`Esperando a ${partnerName ?? 'tu socio'}`}>
            {pending.map((r) => (
              <ListRow
                key={r.id}
                title={`${r.target_name ?? 'Todas las apps'}${r.minutes_requested ? ` · ${r.minutes_requested} min más` : ''}`}
                subtitle={r.reason ? `“${r.reason}”` : timeAgo(r.created_at)}
                right={timeAgo(r.created_at).replace('hace ', '')}
                onPress={() => router.push({ pathname: '/request/[id]', params: { id: r.id } })}
              />
            ))}
          </Section>
        )}

        {rules.length === 0 && supervised.length === 0 && <Button title="Crear mi primer límite" onPress={() => router.push('/rules/new')} />}
        {partners.length > 0 && <TextLink title="Pedir tiempo extra →" onPress={() => router.push('/blocked')} />}
      </ScrollView>
    </SafeAreaView>
  );
}
