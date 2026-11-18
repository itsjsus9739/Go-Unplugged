import { router } from 'expo-router';
import { useRef, useState } from 'react';

import { Body, Button, ChipPicker, ErrorText, Field, Heading, Screen } from '../../../components/ui';
import { friendlyError } from '../../../lib/errors';
import { formatMinutes } from '../../../lib/format';
import { useAuthed } from '../../../providers/SessionProvider';
import { createRule } from '../../../services/rules';

const LIMITS = [15, 30, 45, 60, 90, 120];

export default function NewRule() {
  const { userId } = useAuthed();
  const [name, setName] = useState('Redes sociales');
  const [limit, setLimit] = useState(60);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false); // evita crear el límite dos veces con un doble toque
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const rule = await createRule({ userId, name: name.trim(), dailyLimitMinutes: limit });
      router.replace({ pathname: '/rules/[id]', params: { id: rule.id } });
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
      submitting.current = false;
    }
  }

  return (
    <Screen>
      <Field label="Nombre" value={name} onChangeText={setName} maxLength={40} />
      <Heading>Límite diario</Heading>
      <ChipPicker options={LIMITS} value={limit} onChange={setLimit} format={formatMinutes} />
      <Body muted>Después eliges qué apps entran en este límite.</Body>
      <ErrorText>{error}</ErrorText>
      <Button title="Crear y elegir apps" onPress={save} loading={busy} disabled={!name.trim()} />
    </Screen>
  );
}
