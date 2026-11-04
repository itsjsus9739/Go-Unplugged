import { useState } from 'react';

import { PermissionsPanel } from '../../../components/PermissionsPanel';
import { Badge, Body, Button, Card, ErrorText, Field, Heading, Row, Screen } from '../../../components/ui';
import { useAsync } from '../../../hooks/useAsync';
import { friendlyError } from '../../../lib/errors';
import { supabase } from '../../../lib/supabase';
import { useAuthed } from '../../../providers/SessionProvider';
import { signOut } from '../../../services/auth';
import { updateMyProfile } from '../../../services/profile';

export default function Settings() {
  const { userId, profile, refreshProfile, session } = useAuthed();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const { data: sub } = useAsync(
    async () => (await supabase.from('subscriptions').select('tier, status').eq('user_id', userId).maybeSingle()).data,
    [userId],
  );

  async function saveName() {
    try {
      await updateMyProfile(userId, { display_name: name.trim() });
      await refreshProfile();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <Screen>
      <Card>
        <Heading>Perfil</Heading>
        <Body muted>{session?.user.email}</Body>
        <Field label="Nombre visible para tu socio" value={name} onChangeText={setName} />
        <Button title="Guardar" variant="secondary" onPress={saveName} disabled={!name.trim() || name === profile?.display_name} />
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Heading>Plan</Heading>
          <Badge label={sub?.tier ?? 'free'} tone="primary" />
        </Row>
        <Body muted>Los pagos aún no están integrados (precios ilustrativos). Ver docs/ARQUITECTURA.md.</Body>
      </Card>

      <Card>
        <Heading>Urgencias</Heading>
        <Body muted>
          {profile?.emergency_unlocks_per_month} desbloqueos al mes de {profile?.emergency_unlock_minutes} min. Puedes bajar
          estos valores cuando quieras; subirlos requiere a tu socio.
        </Body>
      </Card>

      <Heading>Permisos de este teléfono</Heading>
      <PermissionsPanel />

      <ErrorText>{error}</ErrorText>
      <Button title="Cerrar sesión" variant="ghost" onPress={() => signOut().catch((e) => setError(friendlyError(e)))} />
    </Screen>
  );
}
