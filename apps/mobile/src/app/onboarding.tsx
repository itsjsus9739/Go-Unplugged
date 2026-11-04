import { useState } from 'react';
import { Platform, Share, View } from 'react-native';

import { PermissionsPanel } from '../components/PermissionsPanel';
import { Body, Button, Card, ErrorText, Eyebrow, Field, Heading, Screen, Title } from '../components/ui';
import { friendlyError } from '../lib/errors';
import { useAuthed } from '../providers/SessionProvider';
import { acceptInvitation, createInvitation } from '../services/partnerships';
import { updateMyProfile } from '../services/profile';
import { space } from '../theme';

type Goal = 'limit_me' | 'be_partner';
type Step = 'goal' | 'connect' | 'permissions';

/**
 * Flujo del pitch deck: Elegir → (Solicitar → Aprobar → Sincronizar).
 * 1) ¿Quieres limitar tu tiempo o ser socio de alguien?
 * 2) Conectar con la otra persona por código.
 * 3) Permisos del sistema para el bloqueo (solo quien limita su tiempo).
 */
export default function Onboarding() {
  const { userId, refreshProfile } = useAuthed();
  const [step, setStep] = useState<Step>('goal');
  const [goal, setGoal] = useState<Goal>('limit_me');
  const [code, setCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const inv = await createInvitation(goal === 'limit_me' ? 'monitored' : 'partner');
      setCode(inv.code);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await acceptInvitation(inputCode);
      setConnected(true);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    try {
      await updateMyProfile(userId, { onboarding_completed: true });
      await refreshProfile(); // el layout raíz pasa a (app)
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  if (step === 'goal') {
    return (
      <Screen>
        <Eyebrow>Paso 1 de 3</Eyebrow>
        <Title>¿Cómo vas a usar Go Unplugged?</Title>
        <Card style={{ borderColor: goal === 'limit_me' ? '#3B34D0' : undefined }}>
          <Heading>Quiero recuperar mi tiempo</Heading>
          <Body muted>Pones tus límites y eliges a alguien de confianza que apruebe cada extensión.</Body>
          <Button title={goal === 'limit_me' ? '✓ Elegido' : 'Elegir'} variant={goal === 'limit_me' ? 'primary' : 'secondary'} onPress={() => setGoal('limit_me')} />
        </Card>
        <Card style={{ borderColor: goal === 'be_partner' ? '#3B34D0' : undefined }}>
          <Heading>Voy a ser socio de alguien</Heading>
          <Body muted>Recibirás sus peticiones de tiempo y decidirás en un toque. Nunca verás sus chats ni publicaciones.</Body>
          <Button title={goal === 'be_partner' ? '✓ Elegido' : 'Elegir'} variant={goal === 'be_partner' ? 'primary' : 'secondary'} onPress={() => setGoal('be_partner')} />
        </Card>
        <Button title="Continuar" onPress={() => setStep('connect')} />
      </Screen>
    );
  }

  if (step === 'connect') {
    return (
      <Screen>
        <Eyebrow>Paso 2 de 3</Eyebrow>
        <Title>{goal === 'limit_me' ? 'Invita a tu socio de confianza' : 'Conéctate con quien vas a acompañar'}</Title>

        <Card>
          <Heading>Compartir un código</Heading>
          {code ? (
            <View style={{ gap: space.md }}>
              <Title style={{ letterSpacing: 6, textAlign: 'center' }}>{code}</Title>
              <Body muted>Válido por 7 días. La otra persona lo ingresa en su app.</Body>
              <Button
                title="Compartir"
                variant="secondary"
                onPress={() =>
                  Share.share({
                    message: `Únete a mi acuerdo en Go Unplugged con el código ${code}`,
                  })
                }
              />
            </View>
          ) : (
            <Button title="Generar código" onPress={generate} loading={busy} />
          )}
        </Card>

        <Card>
          <Heading>¿Te dieron un código?</Heading>
          <Field label="Código de 8 caracteres" value={inputCode} onChangeText={(t) => setInputCode(t.toUpperCase())} autoCapitalize="characters" maxLength={8} />
          {connected ? <Body>✅ ¡Acuerdo activo!</Body> : <Button title="Unirme" variant="secondary" onPress={accept} loading={busy} disabled={inputCode.length !== 8} />}
        </Card>

        <ErrorText>{error}</ErrorText>
        <Button title={goal === 'limit_me' ? 'Continuar' : 'Terminar'} onPress={() => (goal === 'limit_me' ? setStep('permissions') : finish())} loading={busy && goal !== 'limit_me'} />
        <Body muted style={{ textAlign: 'center' }}>Puedes conectar a tu socio más tarde desde la pestaña «Acuerdo».</Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <Eyebrow>Paso 3 de 3</Eyebrow>
      <Title>Activa el bloqueo en este teléfono</Title>
      <Body muted>
        {Platform.OS === 'ios'
          ? 'Go Unplugged usa Tiempo en pantalla de Apple para bloquear las apps que elijas.'
          : 'Go Unplugged necesita dos permisos para saber cuánto usas cada app y bloquearla cuando se acabe tu tiempo.'}
      </Body>
      <PermissionsPanel />
      <ErrorText>{error}</ErrorText>
      <Button title="Terminar" onPress={finish} loading={busy} />
    </Screen>
  );
}
