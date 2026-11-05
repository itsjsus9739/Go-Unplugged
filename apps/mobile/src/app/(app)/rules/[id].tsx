import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable } from 'react-native';

import { AppBlocker, isNativeBlockerAvailable, type LaunchableApp } from '../../../../modules/app-blocker';
import { Body, Button, Card, ChipPicker, ErrorText, Field, Heading, Row, Screen } from '../../../components/ui';
import { useAsync } from '../../../hooks/useAsync';
import { errorCode, friendlyError } from '../../../lib/errors';
import { DAY_LABELS, formatMinutes } from '../../../lib/format';
import { useAuthed } from '../../../providers/SessionProvider';
import {
  addTarget,
  deleteRuleOrRequest,
  getRule,
  removeTargetOrRequest,
  updateRuleOrRequest,
  type RulePatch,
} from '../../../services/rules';
import { space, useThemeColors } from '../../../theme';

const LIMITS = [0, 15, 30, 45, 60, 90, 120, 180];

/** Editar un límite. Lo usan el dueño (endurecer / pedir aflojar) y su socio (edición directa). */
export default function RuleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, device, resync } = useAuthed();
  const c = useThemeColors();
  const { data: rule, reload } = useAsync(() => getRule(id), [id]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [savingApp, setSavingApp] = useState<string | null>(null);
  const { data: apps } = useAsync<LaunchableApp[]>(
    () => (showPicker && Platform.OS !== 'ios' ? AppBlocker.getLaunchableApps() : Promise.resolve([])),
    [showPicker],
  );

  const isOwner = rule?.user_id === userId;
  const selected = useMemo(() => new Set(rule?.rule_targets.map((t) => t.identifier)), [rule]);

  async function change(patch: RulePatch) {
    setError(null);
    try {
      const res = await updateRuleOrRequest(id, patch);
      if (!res.applied) Alert.alert('Petición enviada', 'Aflojar un límite necesita la aprobación de tu socio. Te avisamos cuando responda.');
      await reload();
      await resync();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function toggleApp(app: LaunchableApp) {
    if (!rule || savingApp) return; // evita el doble toque mientras se guarda
    setSavingApp(app.identifier);
    setError(null);
    try {
      const existing = rule.rule_targets.find((t) => t.identifier === app.identifier);
      if (existing) {
        const res = await removeTargetOrRequest(existing);
        if (!res.applied) Alert.alert('Petición enviada', `Quitar ${app.name} necesita la aprobación de tu socio.`);
      } else {
        await addTarget({ ruleId: rule.id, userId: rule.user_id, platform: 'android', identifier: app.identifier, displayName: app.name });
      }
      await reload();
      await resync();
    } catch (e) {
      if (errorCode(e) === 'plan_app_limit') {
        Alert.alert('Llegaste al tope de tu plan', 'El plan Gratis permite limitar hasta 3 apps.', [
          { text: 'Ahora no', style: 'cancel' },
          { text: 'Ver planes', onPress: () => router.push('/plans') },
        ]);
      } else {
        setError(friendlyError(e));
      }
    } finally {
      setSavingApp(null);
    }
  }

  async function pickIos() {
    if (!rule) return;
    try {
      const res = await AppBlocker.presentAppPicker(rule.id);
      if (!res) return;
      const parts = [
        res.applications && `${res.applications} apps`,
        res.categories && `${res.categories} categorías`,
        res.webDomains && `${res.webDomains} sitios`,
      ].filter(Boolean);
      await addTarget({
        ruleId: rule.id,
        userId: rule.user_id,
        platform: 'ios',
        identifier: `ios-selection:${rule.id}`,
        displayName: parts.join(', ') || 'Selección vacía',
        deviceId: device?.id,
      });
      await reload();
      await resync();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function confirmDelete() {
    Alert.alert('Eliminar límite', isOwner ? 'Se le pedirá a tu socio si tienes uno.' : '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await deleteRuleOrRequest(id);
            if (!res.applied) Alert.alert('Petición enviada', 'Tu socio decidirá.');
            router.back();
          } catch (e) {
            setError(friendlyError(e));
          }
        },
      },
    ]);
  }

  if (!rule) return <Screen><Body muted>Cargando…</Body></Screen>;

  const filtered = (apps ?? []).filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Screen>
      <Heading>{rule.name}</Heading>

      <Card>
        <Heading>Límite diario: {formatMinutes(rule.daily_limit_minutes)}</Heading>
        <ChipPicker options={LIMITS} value={rule.daily_limit_minutes} onChange={(v) => change({ daily_limit_minutes: v })} format={(m) => (m === 0 ? 'Bloqueo total' : formatMinutes(m))} />
      </Card>

      <Card>
        <Heading>Días</Heading>
        <Row style={{ flexWrap: 'wrap' }}>
          {DAY_LABELS.map((label, i) => {
            const day = i + 1;
            const on = rule.active_days.includes(day);
            return (
              <Pressable
                key={label}
                onPress={() =>
                  change({ active_days: on ? rule.active_days.filter((d) => d !== day) : [...rule.active_days, day].sort() })
                }
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? c.primary : c.bgRaised2,
                }}
              >
                <Body style={{ color: on ? c.onPrimary : c.inkSoft }}>{label}</Body>
              </Pressable>
            );
          })}
        </Row>
      </Card>

      <Card>
        <Heading>Apps en este límite</Heading>
        {rule.rule_targets.length === 0 && <Body muted>Ninguna todavía.</Body>}
        {rule.rule_targets.map((t) => (
          <Row key={t.id} style={{ justifyContent: 'space-between' }}>
            <Body>{t.display_name}</Body>
            {Platform.OS !== 'ios' && (
              <Button title="Quitar" variant="ghost" onPress={() => toggleApp({ identifier: t.identifier, name: t.display_name })} style={{ minHeight: 36 }} />
            )}
          </Row>
        ))}
        {isOwner &&
          (Platform.OS === 'ios' ? (
            <Button title="Elegir apps (Tiempo en pantalla)" variant="secondary" onPress={pickIos} disabled={!isNativeBlockerAvailable} />
          ) : (
            <Button title={showPicker ? 'Ocultar lista' : 'Agregar apps'} variant="secondary" onPress={() => setShowPicker((v) => !v)} />
          ))}
        {showPicker && (
          <>
            <Field label="Buscar" value={search} onChangeText={setSearch} />
            {filtered.map((a) => (
              <Pressable key={a.identifier} onPress={() => toggleApp(a)}>
                <Row style={{ justifyContent: 'space-between', paddingVertical: space.xs }}>
                  <Body>{a.name}</Body>
                  <Body style={{ color: selected.has(a.identifier) ? c.primary : c.inkFaint }}>
                    {savingApp === a.identifier ? '…' : selected.has(a.identifier) ? '✓' : '+'}
                  </Body>
                </Row>
              </Pressable>
            ))}
          </>
        )}
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button
        title={rule.is_active ? 'Pausar límite' : 'Reactivar límite'}
        variant="secondary"
        onPress={() => change({ is_active: !rule.is_active })}
      />
      <Button title="Eliminar límite" variant="ghost" onPress={confirmDelete} />
    </Screen>
  );
}
