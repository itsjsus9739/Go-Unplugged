import { Link } from 'expo-router';
import { View } from 'react-native';

import { Logo } from '../../components/Logo';
import { Body, Button, Card, Eyebrow, Screen, Title } from '../../components/ui';
import { isSupabaseConfigured } from '../../lib/env';
import { space } from '../../theme';

/** Bienvenida: propuesta de valor + pilares de marca. */
export default function Welcome() {
  return (
    <Screen>
      <View style={{ marginTop: space.xxl, gap: space.xl }}>
        <Logo />
        <Title style={{ fontSize: 34, lineHeight: 40 }}>Recupera tu tiempo. Con alguien que te acompañe.</Title>
        <Body muted>
          Le entregas el control de tus límites de pantalla a un familiar o amigo de confianza. Cada minuto extra que
          pidas pasa primero por su aprobación.
        </Body>
        <Eyebrow>Un límite · Un acuerdo · Más tiempo</Eyebrow>
      </View>

      {!isSupabaseConfigured && (
        <Card>
          <Body>
            ⚠️ Falta configurar Supabase. Copia <Body style={{ fontWeight: '700' }}>.env.example</Body> a{' '}
            <Body style={{ fontWeight: '700' }}>.env</Body> con la URL y la anon key del proyecto.
          </Body>
        </Card>
      )}

      <View style={{ gap: space.md, marginTop: space.lg }}>
        <Link href="/sign-up" asChild>
          <Button title="Empieza gratis" />
        </Link>
        <Link href="/sign-in" asChild>
          <Button title="Ya tengo cuenta" variant="secondary" />
        </Link>
      </View>
    </Screen>
  );
}
