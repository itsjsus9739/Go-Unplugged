import { router } from 'expo-router';

import { Badge, Body, Button, Card, Heading, Row, Screen } from '../../../components/ui';
import { useAsync } from '../../../hooks/useAsync';
import { useRealtime } from '../../../hooks/useRealtime';
import { DAY_LABELS, formatMinutes, hhmm } from '../../../lib/format';
import { useAuthed } from '../../../providers/SessionProvider';
import { listRules } from '../../../services/rules';

export default function Limits() {
  const { userId } = useAuthed();
  const { data: rules, reload } = useAsync(() => listRules(userId), [userId]);
  useRealtime('limit_rules', reload, `user_id=eq.${userId}`);
  useRealtime('rule_targets', reload, `user_id=eq.${userId}`);

  return (
    <Screen>
      <Body muted>
        Endurecer un límite es inmediato. Aflojarlo (más minutos, pausar, quitar apps) se le pide a tu socio.
      </Body>
      {rules?.map((r) => (
        <Card key={r.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Heading>{r.name}</Heading>
            <Badge label={r.is_active ? formatMinutes(r.daily_limit_minutes) + '/día' : 'Pausado'} tone={r.is_active ? 'primary' : 'neutral'} />
          </Row>
          <Body muted>{r.rule_targets.map((t) => t.display_name).join(' · ') || 'Sin apps todavía'}</Body>
          <Body muted>
            {r.active_days.length === 7 ? 'Todos los días' : r.active_days.map((d) => DAY_LABELS[d - 1]).join(' ')}
            {r.block_start ? ` · Bloqueo total ${hhmm(r.block_start)}–${hhmm(r.block_end)}` : ''}
          </Body>
          <Button title="Editar" variant="secondary" onPress={() => router.push({ pathname: '/rules/[id]', params: { id: r.id } })} />
        </Card>
      ))}
      <Button title="Nuevo límite" onPress={() => router.push('/rules/new')} />
    </Screen>
  );
}
