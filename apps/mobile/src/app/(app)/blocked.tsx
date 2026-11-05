import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Body, Button, ErrorText, BigNumber, LineField, Screen, Segmented, TextLink } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { useNow } from '../../hooks/useNow';
import { useRealtime } from '../../hooks/useRealtime';
import { friendlyError } from '../../lib/errors';
import { clock, formatMinutes, todayISODate } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { useAuthed } from '../../providers/SessionProvider';
import { listPartnerships } from '../../services/partnerships';
import { getRequest, requestExtension } from '../../services/requests';
import { listRules, type RuleWithTargets } from '../../services/rules';
import { brand, fonts, space, useThemeColors } from '../../theme';

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
 * Pantalla de bloqueo (gounplugged://blocked?app=…&rule=…).
 * Toma la escena 1 del video de marca: el contador gigante en 00:00.
 */
export default function Blocked() {
  const { app, rule } = useLocalSearchParams<{ app?: string; rule?: string }>();
  const { userId, device, profile, resync } = useAuthed();
  const c = useThemeColors();
  const now = useNow();
  const [minutes, setMinutes] = useState(15);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const { data } = useAsync(async () => {
    const [rules, partnerships, usage] = await Promise.all([
      listRules(userId),
      listPartnerships(),
      supabase.from('usage_daily').select('identifier, minutes_used').eq('user_id', userId).eq('usage_date', todayISODate()),
    ]);
    return { rules, partnerships, usage: usage.data ?? [] };
  }, [userId]);
  const target = findTarget(data?.rules ?? [], app, rule);
  const partnerName = data?.partnerships.find((p) => p.monitored_id === userId)?.partner?.display_name ?? 'tu socio';
  const used = target
    ? target.rule.rule_targets.reduce((a, t) => a + (data?.usage.find((u) => u.identifier === t.identifier)?.minutes_used ?? 0), 0)
    : 0;

  const { data: request, reload } = useAsync(() => (requestId ? getRequest(requestId) : Promise.resolve(null)), [requestId]);
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

  const appName = target?.target?.display_name ?? target?.rule.name ?? 'esta app';

  if (request) {
    const approved = request.status === 'approved';
    const denied = request.status === 'denied' || request.status === 'expired';
    return (
      <Screen>
        <View style={{ marginTop: space.xxl * 2, gap: space.lg }}>
          <BigNumber size={72}>
            {approved ? clock(new Date(request.grant_ends_at!).getTime() - now) : denied ? '00:00' : `+${request.minutes_requested ?? ''}`}
          </BigNumber>
          <Text style={{ fontFamily: fonts.heading, fontSize: 28, lineHeight: 34, color: c.ink }}>
            {approved ? `${partnerName} te dio ${request.minutes_granted} min.` : denied ? 'Hoy no.' : `Le preguntamos a ${partnerName}.`}
          </Text>
          <Body muted>
            {approved
              ? `${appName} queda abierta mientras corre el reloj.`
              : denied
                ? request.decision_note
                  ? `“${request.decision_note}” — ${partnerName}`
                  : 'Mañana el contador vuelve a empezar.'
                : 'Te avisamos apenas responda. Puedes cerrar esta pantalla.'}
          </Body>
          <Button title={approved ? 'Listo' : 'Volver al inicio'} variant={approved ? 'primary' : 'secondary'} onPress={() => router.replace('/')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ marginTop: space.xxl, gap: space.md }}>
        <BigNumber size={80}>00:00</BigNumber>
        <Text style={{ fontFamily: fonts.heading, fontSize: 28, lineHeight: 34, color: c.ink }}>
          Se acabó tu tiempo en {appName}.
        </Text>
        {target ? (
          <Body muted>
            Llevas {used} de {formatMinutes(target.rule.daily_limit_minutes)} hoy en {target.rule.name.toLowerCase()}.
          </Body>
        ) : null}
      </View>

      <View style={{ gap: space.lg, marginTop: space.xl }}>
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: c.ink }}>¿Cuánto más necesitas?</Text>
        <Segmented options={MINUTE_OPTIONS} value={minutes} onChange={setMinutes} />
        <LineField label="Para qué (opcional)" value={reason} onChangeText={setReason} maxLength={280} placeholder="Responder al grupo del taller" />
        <Button title={`Pedirle ${minutes} min a ${partnerName}`} onPress={() => send('time_extension')} loading={busy} />
        <ErrorText>{error}</ErrorText>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.lg }}>
        <TextLink title="Mejor no" color={c.inkSoft} onPress={() => router.replace('/')} />
        <TextLink
          title={`Es una urgencia (${profile?.emergency_unlocks_per_month ?? 0} al mes)`}
          color={brand.magenta}
          onPress={() => send('emergency')}
        />
      </View>
    </Screen>
  );
}
