import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Card, ChipPicker, ErrorText, Eyebrow, Field, Heading, Screen, Title } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { useRealtime } from '../../hooks/useRealtime';
import { friendlyError } from '../../lib/errors';
import { formatMinutes, minutesLeft } from '../../lib/format';
import { useAuthed } from '../../providers/SessionProvider';
import { getRequest, requestExtension } from '../../services/requests';
import { listRules, type RuleWithTargets } from '../../services/rules';
import { brand, space } from '../../theme';

const MINUTE_OPTIONS = [5, 10, 15, 30, 60];

function findTarget(rules: RuleWithTargets[], app?: string, ruleId?: string) {
  for (const r of rules) {
    if (ruleId && r.id !== ruleId) continue;
    const t = r.rule_targets.find((x) => x.identifier === app);
    if (t || r.id === ruleId) return { rule: r, target: t ?? null };
  }
  return null;
}

/**
 * Pantalla de bloqueo. La abre el servicio nativo (gounplugged://blocked?app=…&rule=…)
 * cuando se agota el tiempo, o el usuario desde "Pedir tiempo extra".
 * 01 Se agota el tiempo → 02 Pides una extensión → 03 Tu socio decide.
 */
export default function Blocked() {
  const { app, rule } = useLocalSearchParams<{ app?: string; rule?: string }>();
  const { userId, device, profile, resync } = useAuthed();
  const [minutes, setMinutes] = useState(15);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const { data: rules } = useAsync(() => listRules(userId), [userId]);
  const target = findTarget(rules ?? [], app, rule);

  const { data: request, reload } = useAsync(
    () => (requestId ? getRequest(requestId) : Promise.resolve(null)),
    [requestId],
  );
  useRealtime('extension_requests', reload, requestId ? `id=eq.${requestId}` : undefined, !!requestId);

  useEffect(() => {
    if (request?.status === 'approved') resync();
  }, [request?.status, resync]);

  async function send(kind: 'time_extension' | 'emergency') {
    setBusy(true);
    setError(null);
    try {
      const req = await requestExtension({
        kind,
        minutes: kind === 'time_extension' ? minutes : undefined,
        reason,
        ruleId: target?.rule.id,
        targetIdentifier: target?.target?.identifier ?? app,
        targetName: target?.target?.display_name ?? target?.rule.name,
        deviceId: device?.id,
      });
      setRequestId(req.id);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const appName = target?.target?.display_name ?? target?.rule.name ?? 'Esta app';

  if (request) {
    const approved = request.status === 'approved';
    const denied = request.status === 'denied' || request.status === 'expired';
    return (
      <Screen>
        <Eyebrow color={approved ? brand.cyan : denied ? brand.magenta : undefined}>
          {approved ? 'Aprobada' : denied ? 'Límite mantenido' : 'Esperando a tu socio'}
        </Eyebrow>
        <Title>
          {approved
            ? `Tienes ${minutesLeft(request.grant_ends_at!)} min más`
            : denied
              ? 'Hoy no. Mantén el enfoque.'
              : 'Tu petición va en camino'}
        </Title>
        <Body muted>
          {approved
            ? `${appName} queda desbloqueada hasta que se acabe el tiempo aprobado.`
            : denied
              ? request.decision_note ?? 'Tu socio decidió mantener el límite. Mañana tienes tiempo nuevo.'
              : 'Te avisamos en cuanto tu socio responda. No necesitas sincronizar nada.'}
        </Body>
        <Button title={approved ? 'Listo' : 'Volver al inicio'} onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ marginTop: space.xl, gap: space.sm }}>
        <Eyebrow color={brand.magenta}>Tiempo agotado</Eyebrow>
        <Title style={{ fontSize: 34, lineHeight: 40 }}>{appName} está bloqueada</Title>
        <Body muted>
          {target ? `Límite diario: ${formatMinutes(target.rule.daily_limit_minutes)}. ` : ''}
          Si de verdad lo necesitas, pídeselo a tu socio.
        </Body>
      </View>

      <Card>
        <Heading>¿Cuánto tiempo necesitas?</Heading>
        <ChipPicker options={MINUTE_OPTIONS} value={minutes} onChange={setMinutes} format={(m) => `${m} min`} />
        <Field label="¿Para qué? (opcional)" value={reason} onChangeText={setReason} maxLength={280} placeholder="Responder un mensaje del grupo de la U" />
        <Button title="Pedir a mi socio" onPress={() => send('time_extension')} loading={busy} />
      </Card>

      <Card>
        <Heading>¿Es una urgencia?</Heading>
        <Body muted>
          Tienes {profile?.emergency_unlocks_per_month ?? 0} desbloqueos de urgencia al mes ({profile?.emergency_unlock_minutes ?? 0} min). Tu socio se entera igual.
        </Body>
        <Button title="Usar desbloqueo de urgencia" variant="ghost" onPress={() => send('emergency')} loading={busy} />
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button title="Mejor no, volver" variant="ghost" onPress={() => router.replace('/')} />
    </Screen>
  );
}
