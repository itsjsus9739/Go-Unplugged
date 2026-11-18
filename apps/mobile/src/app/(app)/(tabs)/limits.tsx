import { router } from 'expo-router';
import { Text } from 'react-native';

import { Body, ListRow, Screen, Section, TextLink } from '../../../components/ui';
import { useAsync } from '../../../hooks/useAsync';
import { useReloadOnFocus } from '../../../hooks/useReloadOnFocus';
import { useRealtime } from '../../../hooks/useRealtime';
import { DAY_LABELS, formatMinutes, hhmm } from '../../../lib/format';
import { useAuthed } from '../../../providers/SessionProvider';
import { listRules } from '../../../services/rules';
import { fonts, space, useThemeColors } from '../../../theme';

export default function Limits() {
  const { userId } = useAuthed();
  const c = useThemeColors();
  const { data: rules, reload } = useAsync(() => listRules(userId), [userId]);
  useReloadOnFocus(reload);
  useRealtime('limit_rules', reload, `user_id=eq.${userId}`);
  useRealtime('rule_targets', reload, `user_id=eq.${userId}`);

  const days = (d: number[]) =>
    d.length === 7 ? 'Todos los días' : d.join() === '1,2,3,4,5' ? 'Entre semana' : d.map((x) => DAY_LABELS[x - 1]).join(' ');

  return (
    <Screen>
      <Text style={{ fontFamily: fonts.heading, fontSize: 30, color: c.ink, marginTop: space.md }}>Límites</Text>
      <Body muted>Bajarlos es inmediato. Para subirlos le preguntamos a tu socio.</Body>
      <Section title="Lo que acordaste" action={<TextLink title="+ Nuevo" onPress={() => router.push('/rules/new')} />}>
        {rules?.map((r) => (
          <ListRow
            key={r.id}
            title={r.name}
            subtitle={[
              r.rule_targets.map((t) => t.display_name).join(', ') || 'Sin apps todavía',
              days(r.active_days),
              r.block_start ? `nada de ${hhmm(r.block_start)} a ${hhmm(r.block_end)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            right={r.is_active ? formatMinutes(r.daily_limit_minutes) : 'Pausado'}
            chevron
            onPress={() => router.push({ pathname: '/rules/[id]', params: { id: r.id } })}
          />
        ))}
      </Section>
    </Screen>
  );
}
