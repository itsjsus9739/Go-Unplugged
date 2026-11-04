import { Link } from 'expo-router';
import { useState } from 'react';

import { Body, Button, ErrorText, Field, Screen, Title } from '../../components/ui';
import { friendlyError } from '../../lib/errors';
import { signUp } from '../../services/auth';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const { session } = await signUp(email, password, name);
      if (!session) setNeedsConfirm(true); // confirmación por correo activada en Supabase
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  if (needsConfirm) {
    return (
      <Screen>
        <Title>Revisa tu correo</Title>
        <Body muted>Te enviamos un enlace a {email} para confirmar tu cuenta. Luego vuelve e inicia sesión.</Body>
        <Link href="/sign-in" asChild>
          <Button title="Ir a iniciar sesión" />
        </Link>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Crea tu cuenta</Title>
      <Field label="¿Cómo te llamas?" value={name} onChangeText={setName} autoComplete="name" />
      <Field label="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Contraseña (mín. 8)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <ErrorText>{error}</ErrorText>
      <Button title="Crear cuenta" onPress={submit} loading={loading} disabled={!name || !email || password.length < 8} />
      <Link href="/sign-in">
        <Body muted>Ya tengo cuenta</Body>
      </Link>
    </Screen>
  );
}
