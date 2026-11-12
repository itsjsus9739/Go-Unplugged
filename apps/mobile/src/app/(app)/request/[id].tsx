import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { RequestCard } from '../../../components/RequestCard';
import { Body, Button, ChipPicker, ErrorText, Field, Heading, Row, Screen } from '../../../components/ui';
import { useAsync } from '../../../hooks/useAsync';
import { useRealtime } from '../../../hooks/useRealtime';
import { friendlyError } from '../../../lib/errors';
import { useAuthed } from '../../../providers/SessionProvider';
import { cancelRequest, decideRequest, getRequest } from '../../../services/requests';

/** Detalle de una petición (se abre desde la notificación push). */
export default function RequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuthed();
  const { data: req, reload, error: loadError, loading } = useAsync(() => getRequest(id), [id]);
  useRealtime('extension_requests', reload, `id=eq.${id}`);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!req) {
    return (
      <Screen>
        {loading && !loadError ? (
          <Body muted>Cargando…</Body>
        ) : (
          <>
            <Body muted>Esta petición ya no existe.</Body>
            <Button title="Volver" variant="secondary" onPress={() => router.back()} />
          </>
        )}
      </Screen>
    );
  }

  const mine = req.requester_id === userId;
  const pending = req.status === 'pending';
  const options = [...new Set([5, 10, 15, 30, 60, req.minutes_requested ?? 15])].sort((a, b) => a - b);
  const chosen = minutes ?? req.minutes_requested ?? 15;

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <RequestCard request={req} />
      {pending && !mine && (
        <>
          {req.kind === 'time_extension' && (
            <>
              <Heading>Aprobar cuánto tiempo</Heading>
              <ChipPicker options={options} value={chosen} onChange={setMinutes} format={(m) => `${m} min`} />
            </>
          )}
          <Field label="Nota (opcional)" value={note} onChangeText={setNote} maxLength={280} placeholder="¡Tú puedes!" />
          <Row>
            <Button title="Mantener límite" variant="secondary" style={{ flex: 1 }} loading={busy} onPress={() => act(() => decideRequest(id, false, undefined, note))} />
            <Button title="Aprobar" style={{ flex: 1 }} loading={busy} onPress={() => act(() => decideRequest(id, true, chosen, note))} />
          </Row>
        </>
      )}
      {pending && mine && <Button title="Cancelar petición" variant="ghost" loading={busy} onPress={() => act(() => cancelRequest(id))} />}
      <ErrorText>{error}</ErrorText>
      {!pending && <Button title="Volver" variant="secondary" onPress={() => router.back()} />}
    </Screen>
  );
}
