import { Link } from 'expo-router';
import { useState } from 'react';

import { Body, Button, ErrorText, Field, Screen, Title } from '../../components/ui';
import { friendlyError } from '../../lib/errors';
import { signIn } from '../../services/auth';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password); // el layout raíz redirige al cambiar la sesión
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Title>Inicia sesión</Title>
      <Field label="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
      <ErrorText>{error}</ErrorText>
      <Button title="Entrar" onPress={submit} loading={loading} disabled={!email || !password} />
      <Link href="/sign-up">
        <Body muted>¿No tienes cuenta? Crea una</Body>
      </Link>
    </Screen>
  );
}
