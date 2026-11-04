import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Share, View } from 'react-native';

import { RequestCard } from '../../../components/RequestCard';
import { Badge, Body, Button, Card, ErrorText, Eyebrow, Field, Heading, Row, Screen, Title } from '../../../components/ui';
import { useAsync } from '../../../hooks/useAsync';
import { useRealtime } from '../../../hooks/useRealtime';
import { friendlyError } from '../../../lib/errors';
import { formatMinutes } from '../../../lib/format';
import { useAuthed } from '../../../providers/SessionProvider';
import {
  acceptInvitation,
  createInvitation,
  listPartnerships,
  revokePartnership,
  setPartnerPin,
} from '../../../services/partnerships';
import { decideRequest, listRequestsToDecide } from '../../../services/requests';
import { listRules } from '../../../services/rules';
import { space } from '../../../theme';

export default function Partner() {
  const { userId } = useAuthed();
  const [code, setCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pin, setPin] = useState('');

  const { data, reload } = useAsync(async () => {
    const [partnerships, toDecide] = await Promise.all([listPartnerships(), listRequestsToDecide(userId)]);
    const supervised = partnerships.filter((p) => p.partner_id === userId);
    const rulesBy = Object.fromEntries(
      await Promise.all(supervised.map(async (p) => [p.monitored_id, await listRules(p.monitored_id)] as const)),
    );
    return { partnerships, toDecide, supervised, rulesBy };
  }, [userId]);
  useRealtime('extension_requests', reload);
  useRealtime('partnerships', reload);

  const myPartners = data?.partnerships.filter((p) => p.monitored_id === userId) ?? [];
  const nameOf = (id: string) => data?.partnerships.find((p) => p.monitored_id === id)?.monitored?.display_name ?? 'Alguien';

  async function decide(id: string, approve: boolean) {
    setBusyId(id);
    setError(null);
    try {
      await decideRequest(id, approve);
      await reload();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function invite(role: 'monitored' | 'partner') {
    try {
      const inv = await createInvitation(role);
      setCode(inv.code);
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function join() {
    try {
      await acceptInvitation(inputCode);
      setInputCode('');
      await reload();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function savePin(partnershipId: string) {
    try {
      await setPartnerPin(partnershipId, pin);
      setPinFor(null);
      setPin('');
      Alert.alert('PIN guardado', 'Dáselo en persona solo si hace falta (urgencias o desinstalar).');
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function confirmRevoke(id: string, asPartner: boolean) {
    Alert.alert(
      'Terminar acuerdo',
      asPartner ? 'Dejarás de supervisar sus límites.' : 'Tu socio recibirá un aviso y el cambio se hará efectivo en 24 h.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Terminar', style: 'destructive', onPress: () => revokePartnership(id).then(reload).catch((e) => setError(friendlyError(e))) },
      ],
    );
  }

  return (
    <Screen>
      <ErrorText>{error}</ErrorText>

      {!!data?.toDecide.length && (
        <View style={{ gap: space.md }}>
          <Title>Por decidir</Title>
          {data.toDecide.map((r) => (
            <RequestCard key={r.id} request={r} requesterName={nameOf(r.requester_id)}>
              <Row>
                <Button title="Denegar" variant="secondary" style={{ flex: 1 }} loading={busyId === r.id} onPress={() => decide(r.id, false)} />
                <Button title="Aprobar" style={{ flex: 1 }} loading={busyId === r.id} onPress={() => decide(r.id, true)} />
              </Row>
              <Button title="Más opciones" variant="ghost" onPress={() => router.push({ pathname: '/request/[id]', params: { id: r.id } })} />
            </RequestCard>
          ))}
        </View>
      )}

      <Heading>Mi socio de confianza</Heading>
      {myPartners.length === 0 && <Body muted>Nadie todavía. Invita a alguien con un código.</Body>}
      {myPartners.map((p) => (
        <Card key={p.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Heading>{p.partner?.display_name}</Heading>
            <Badge label={p.status === 'active' ? 'Activo' : 'Terminando (24 h)'} tone={p.status === 'active' ? 'success' : 'warning'} />
          </Row>
          {p.status === 'active' && <Button title="Terminar acuerdo" variant="ghost" onPress={() => confirmRevoke(p.id, false)} />}
        </Card>
      ))}

      {!!data?.supervised.length && <Heading>A quién acompaño</Heading>}
      {data?.supervised.map((p) => (
        <Card key={p.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Heading>{p.monitored?.display_name}</Heading>
            {p.status === 'revoking' && <Badge label="Terminando" tone="warning" />}
          </Row>
          {(data.rulesBy[p.monitored_id] ?? []).map((r) => (
            <Row key={r.id} style={{ justifyContent: 'space-between' }}>
              <Body>
                {r.name} · {formatMinutes(r.daily_limit_minutes)}
              </Body>
              <Button title="Editar" variant="ghost" style={{ minHeight: 36 }} onPress={() => router.push({ pathname: '/rules/[id]', params: { id: r.id } })} />
            </Row>
          ))}
          {pinFor === p.id && (
            <>
              <Field label="PIN de socio (4–8 dígitos)" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={8} />
              <Button title="Guardar PIN" onPress={() => savePin(p.id)} disabled={pin.length < 4} />
            </>
          )}
          <Row>
            <Button title="PIN" variant="secondary" style={{ flex: 1 }} onPress={() => setPinFor(pinFor === p.id ? null : p.id)} />
            <Button title="Dejar de acompañar" variant="ghost" style={{ flex: 2 }} onPress={() => confirmRevoke(p.id, true)} />
          </Row>
        </Card>
      ))}

      <Card>
        <Eyebrow>Conectar</Eyebrow>
        {code ? (
          <>
            <Title style={{ letterSpacing: 6, textAlign: 'center' }}>{code}</Title>
            <Button title="Compartir código" variant="secondary" onPress={() => Share.share({ message: `Mi código de Go Unplugged: ${code}` })} />
          </>
        ) : (
          <>
            <Button title="Invitar a mi socio" onPress={() => invite('monitored')} />
            <Button title="Ofrecerme como socio" variant="secondary" onPress={() => invite('partner')} />
          </>
        )}
        <Field label="¿Tienes un código?" value={inputCode} onChangeText={(t) => setInputCode(t.toUpperCase())} autoCapitalize="characters" maxLength={8} />
        <Button title="Unirme" variant="secondary" onPress={join} disabled={inputCode.length !== 8} />
      </Card>
    </Screen>
  );
}
