import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { PermissionsPanel } from '../../../components/PermissionsPanel';
import { Button, ErrorText, LineField, ListRow, Screen, Section, TextLink } from '../../../components/ui';
import { useAsync } from '../../../hooks/useAsync';
import { useReloadOnFocus } from '../../../hooks/useReloadOnFocus';
import { friendlyError } from '../../../lib/errors';
import { useAuthed } from '../../../providers/SessionProvider';
import { signOut } from '../../../services/auth';
import { getMyPlan, PLAN_LABEL } from '../../../services/plans';
import { updateMyProfile } from '../../../services/profile';
import { fonts, space, useThemeColors } from '../../../theme';

export default function Settings() {
  const { userId, profile, refreshProfile, session } = useAuthed();
  const c = useThemeColors();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const { data: plan, reload } = useAsync(() => getMyPlan(), [userId]);
  useReloadOnFocus(reload);

  async function saveName() {
    try {
      await updateMyProfile(userId, { display_name: name.trim() });
      await refreshProfile();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  const planSubtitle = plan
    ? plan.source === 'trial'
      ? 'Prueba gratis'
      : plan.source === 'partner'
        ? 'Cubierto por tu socio'
        : plan.plan.max_apps
          ? `${plan.apps_used} de ${plan.plan.max_apps} apps`
          : 'Apps ilimitadas'
    : null;

  return (
    <Screen>
      <Text style={{ fontFamily: fonts.heading, fontSize: 30, color: c.ink, marginTop: space.md }}>Cuenta</Text>

      <Section title={session?.user.email ?? 'Perfil'}>
        <LineField label="Tu nombre (lo ve tu socio)" value={name} onChangeText={setName} />
        {name.trim() && name !== profile?.display_name ? (
          <TextLink title="Guardar nombre" onPress={saveName} />
        ) : null}
      </Section>

      <Section title="Suscripción">
        <ListRow
          title={plan ? `Plan ${PLAN_LABEL[plan.tier]}` : 'Plan'}
          subtitle={planSubtitle}
          chevron
          onPress={() => router.push('/plans')}
        />
        <ListRow title="Historial de peticiones" chevron onPress={() => router.push('/history')} />
        <ListRow
          title="Desbloqueos de urgencia"
          subtitle={`${profile?.emergency_unlocks_per_month ?? 0} al mes, de ${profile?.emergency_unlock_minutes ?? 0} min. Subirlos requiere a tu socio.`}
        />
      </Section>

      <Section title="Permisos de este teléfono">
        <PermissionsPanel />
      </Section>

      <ErrorText>{error}</ErrorText>
      <Button title="Cerrar sesión" variant="ghost" onPress={() => signOut().catch((e) => setError(friendlyError(e)))} />
    </Screen>
  );
}
