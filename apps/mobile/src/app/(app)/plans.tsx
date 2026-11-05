import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Body, Button, ErrorText, Screen, StatusDot } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { useReloadOnFocus } from '../../hooks/useReloadOnFocus';
import { friendlyError } from '../../lib/errors';
import { getMyPlan, listPlans, PLAN_LABEL, startTrial } from '../../services/plans';
import { brand, fonts, space, useThemeColors } from '../../theme';
import type { MyPlan, Plan } from '../../types/database';

function statusLine(p: MyPlan): string {
  const end = p.current_period_end
    ? new Date(p.current_period_end).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
    : null;
  const apps = p.plan.max_apps ? ` · ${p.apps_used} de ${p.plan.max_apps} apps` : '';
  switch (p.source) {
    case 'trial':
      return `Prueba gratis de ${PLAN_LABEL[p.tier]}${end ? ` hasta el ${end}` : ''}`;
    case 'partner':
      return `Cubierto por el plan ${PLAN_LABEL[p.tier]} de tu socio`;
    case 'own':
      return `Plan ${PLAN_LABEL[p.tier]}${end ? ` · se renueva el ${end}` : ''}`;
    default:
      return `Plan Gratis${apps}`;
  }
}

function price(plan: Plan) {
  return plan.price_usd_month > 0 ? `${plan.price_usd_month.toFixed(2).replace('.', ',')} USD/mes` : 'Gratis';
}

export default function Plans() {
  const c = useThemeColors();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data, reload } = useAsync(async () => {
    const [plans, mine] = await Promise.all([listPlans(), getMyPlan()]);
    return { plans, mine };
  }, []);
  useReloadOnFocus(reload);

  async function choose(plan: Plan) {
    if (!data) return;
    if (data.mine.trial_available) {
      setBusy(plan.tier);
      setError(null);
      try {
        await startTrial(plan.tier as Exclude<Plan['tier'], 'free'>);
        await reload();
        Alert.alert('Listo', `Tienes 7 días de ${plan.name} gratis.`);
      } catch (e) {
        setError(friendlyError(e));
      } finally {
        setBusy(null);
      }
    } else {
      Alert.alert('Muy pronto', 'El pago con Google Play todavía no está disponible. Te avisaremos cuando lo esté.');
    }
  }

  return (
    <Screen>
      <Text style={{ fontFamily: fonts.heading, fontSize: 30, color: c.ink, marginTop: space.md }}>Planes</Text>
      {data && <StatusDot label={statusLine(data.mine)} color={data.mine.tier === 'free' ? c.inkFaint : brand.cyan} />}
      <ErrorText>{error}</ErrorText>

      {data?.plans.map((plan) => {
        const current = plan.tier === data.mine.tier;
        const features = (Array.isArray(plan.features) ? plan.features : []) as string[];
        return (
          <View
            key={plan.tier}
            style={{ gap: space.sm, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: c.line }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ fontFamily: fonts.heading, fontSize: 22, color: c.ink }}>{plan.name}</Text>
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: c.inkSoft }}>{price(plan)}</Text>
            </View>
            {features.map((f) => {
              const soon = /reportes|panel familiar|soporte/i.test(f);
              return (
                <Body key={f} muted>
                  — {f}
                  {soon ? ' (próximamente)' : ''}
                </Body>
              );
            })}
            {current ? (
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: brand.cyan, marginTop: space.xs }}>Tu plan actual</Text>
            ) : plan.tier !== 'free' ? (
              <Button
                title={data.mine.trial_available ? 'Probar 7 días gratis' : `Elegir ${plan.name}`}
                variant={plan.tier === 'pareja' ? 'primary' : 'secondary'}
                loading={busy === plan.tier}
                onPress={() => choose(plan)}
                style={{ marginTop: space.sm }}
              />
            ) : null}
          </View>
        );
      })}

      <Body muted style={{ fontSize: 13 }}>
        Pareja y Familiar cubren también a las personas que acompañas: no necesitan pagar aparte.
      </Body>
    </Screen>
  );
}
