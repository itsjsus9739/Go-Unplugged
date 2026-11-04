import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { AppBlocker, isNativeBlockerAvailable, type BlockerPermissions } from '../../modules/app-blocker';
import { Badge, Body, Button, Card, Heading, Row } from './ui';

/** Estado y accesos directos a los permisos del sistema que necesita el bloqueo. */
export function PermissionsPanel() {
  const [perms, setPerms] = useState<BlockerPermissions | null>(null);

  const refresh = useCallback(() => {
    AppBlocker.getPermissions().then(setPerms).catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    // Al volver de Ajustes, refrescar.
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  if (!isNativeBlockerAvailable) {
    return (
      <Card>
        <Heading>Modo demo</Heading>
        <Body muted>
          Estás en Expo Go o web: el bloqueo real necesita un development build o el APK (ver docs/MOVIL.md). El resto de la
          app funciona igual contra Supabase.
        </Body>
      </Card>
    );
  }

  if (Platform.OS === 'ios') {
    const ok = perms?.familyControls === 'approved';
    return (
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Heading>Tiempo en pantalla</Heading>
          <Badge label={ok ? 'Activo' : 'Pendiente'} tone={ok ? 'success' : 'warning'} />
        </Row>
        {!ok && <Button title="Permitir" onPress={() => AppBlocker.requestAuthorization().finally(refresh)} />}
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Heading>Acceso a datos de uso</Heading>
          <Badge label={perms?.usageAccess ? 'Activo' : 'Pendiente'} tone={perms?.usageAccess ? 'success' : 'warning'} />
        </Row>
        <Body muted>Para contar los minutos que pasas en cada app.</Body>
        {!perms?.usageAccess && <Button title="Abrir ajustes" variant="secondary" onPress={() => AppBlocker.openUsageAccessSettings()} />}
      </Card>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Heading>Servicio de bloqueo</Heading>
          <Badge
            label={perms?.accessibilityService ? 'Activo' : 'Pendiente'}
            tone={perms?.accessibilityService ? 'success' : 'warning'}
          />
        </Row>
        <Body muted>
          Solo detecta qué app está abierta para bloquearla al llegar al límite. No lee tu pantalla, chats ni publicaciones.
        </Body>
        {!perms?.accessibilityService && (
          <Button title="Abrir accesibilidad" variant="secondary" onPress={() => AppBlocker.openAccessibilitySettings()} />
        )}
      </Card>
    </>
  );
}
