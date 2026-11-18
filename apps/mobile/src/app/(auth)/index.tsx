import { Link } from 'expo-router';
import { Text, View } from 'react-native';

import { Logo } from '../../components/Logo';
import { Body, Button, Card, Screen, Title } from '../../components/ui';
import { isSupabaseConfigured } from '../../lib/env';
import { fonts, space, useThemeColors } from '../../theme';

const PILLARS = [
  ['01', 'Un límite', 'Eliges cuándo desconectarte.'],
  ['02', 'Un acuerdo', 'Compartes la decisión.'],
  ['03', 'Más tiempo', 'Lo recuperan juntos.'],
];

/** Bienvenida: propuesta de valor + pilares de marca. */
export default function Welcome() {
  const c = useThemeColors();
  return (
    <Screen>
      <View style={{ marginTop: space.xxl, gap: space.xl }}>
        <Logo />
        <Title style={{ fontSize: 34, lineHeight: 40 }}>Recupera tu tiempo, con alguien que te acompañe.</Title>
        <Body muted>
          Le entregas el control de tus límites de pantalla a un familiar o amigo de confianza. Cada minuto extra que
          pidas pasa primero por su aprobación.
        </Body>
        <View style={{ gap: space.md }}>
          {PILLARS.map(([n, t, d]) => (
            <View key={n} style={{ flexDirection: 'row', gap: space.lg, alignItems: 'baseline' }}>
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: c.primary, fontVariant: ['tabular-nums'] }}>{n}</Text>
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 16, color: c.ink, width: 110 }}>{t}</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 15, color: c.inkSoft, flex: 1 }}>{d}</Text>
            </View>
          ))}
        </View>
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
