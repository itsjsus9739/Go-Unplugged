import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Share, Text, View } from 'react-native';

import {
  Avatar,
  Body,
  Button,
  ErrorText,
  Field,
  BigNumber,
  ListRow,
  Row,
  Screen,
  Section,
  TextLink,
} from '../../../components/ui';
import { useAsync } from '../../../hooks/useAsync';
import { useRealtime } from '../../../hooks/useRealtime';
import { friendlyError } from '../../../lib/errors';
import { formatMinutes, timeAgo } from '../../../lib/format';
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
import { fonts, space, useThemeColors } from '../../../theme';

export default function Partner() {
  const { userId } = useAuthed();
  const c = useThemeColors();
  const [code, setCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [joining, setJoining] = useState(false);

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

  async function invite() {
    try {
      setCode((await createInvitation('monitored')).code);
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function join() {
    try {
      await acceptInvitation(inputCode);
      setInputCode('');
      setJoining(false);
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
      Alert.alert('PIN guardado', 'Dáselo en persona solo si hace falta.');
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function confirmRevoke(id: string, asPartner: boolean) {
    Alert.alert(
      'Terminar el acuerdo',
      asPartner ? 'Dejarás de aprobar su tiempo extra.' : 'Le avisamos a tu socio. El cambio se hace efectivo en 24 horas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Terminar', style: 'destructive', onPress: () => revokePartnership(id).then(reload).catch((e) => setError(friendlyError(e))) },
      ],
    );
  }

  return (
    <Screen>
      <Text style={{ fontFamily: fonts.heading, fontSize: 30, color: c.ink, marginTop: space.md }}>Acuerdo</Text>
      <ErrorText>{error}</ErrorText>

      {data?.toDecide.map((r) => (
        <View key={r.id} style={{ gap: space.md, paddingBottom: space.lg, borderBottomWidth: 1, borderBottomColor: c.line }}>
          <Row>
            <Avatar name={nameOf(r.requester_id)} />
            <Body muted>
              {nameOf(r.requester_id)} · {timeAgo(r.created_at)}
            </Body>
          </Row>
          <Text style={{ fontFamily: fonts.heading, fontSize: 24, lineHeight: 30, color: c.ink }}>
            Quiere {r.minutes_requested} min más de {r.target_name ?? 'pantalla'}.
          </Text>
          {r.reason ? <Body muted>“{r.reason}”</Body> : null}
          <Row>
            <Button title="No" variant="secondary" style={{ flex: 1 }} loading={busyId === r.id} onPress={() => decide(r.id, false)} />
            <Button title={`Darle ${r.minutes_requested} min`} style={{ flex: 2 }} loading={busyId === r.id} onPress={() => decide(r.id, true)} />
          </Row>
          <TextLink title="Darle otra cantidad o dejar una nota →" onPress={() => router.push({ pathname: '/request/[id]', params: { id: r.id } })} />
        </View>
      ))}

      {!!data?.supervised.length &&
        data.supervised.map((p) => (
          <Section key={p.id} title={`Acompañas a ${p.monitored?.display_name}${p.status === 'revoking' ? ' · termina en 24 h' : ''}`}>
            {(data.rulesBy[p.monitored_id] ?? []).map((r) => (
              <ListRow
                key={r.id}
                title={r.name}
                subtitle={r.rule_targets.map((t) => t.display_name).join(', ')}
                right={formatMinutes(r.daily_limit_minutes)}
                chevron
                onPress={() => router.push({ pathname: '/rules/[id]', params: { id: r.id } })}
              />
            ))}
            <ListRow title="PIN de socio" subtitle="Para urgencias o para desinstalar" chevron onPress={() => setPinFor(pinFor === p.id ? null : p.id)}>
              {pinFor === p.id && (
                <View style={{ gap: space.sm }}>
                  <Field label="4 a 8 dígitos" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={8} />
                  <Button title="Guardar PIN" onPress={() => savePin(p.id)} disabled={pin.length < 4} />
                </View>
              )}
            </ListRow>
            <View style={{ paddingTop: space.md, paddingBottom: space.lg }}>
              <TextLink title="Dejar de acompañar" color={c.danger} onPress={() => confirmRevoke(p.id, true)} />
            </View>
          </Section>
        ))}

      <Section title="Tu socio de confianza">
        {myPartners.map((p) => (
          <ListRow
            key={p.id}
            title={p.partner?.display_name ?? ''}
            subtitle={p.status === 'active' ? 'Aprueba tu tiempo extra' : 'El acuerdo termina en 24 h'}
            onPress={p.status === 'active' ? () => confirmRevoke(p.id, false) : undefined}
          />
        ))}
        {myPartners.length === 0 && (
          <View style={{ paddingTop: space.lg, gap: space.md }}>
            {code ? (
              <>
                <Body muted>Pásale este código. Vale por 7 días.</Body>
                <BigNumber size={44}>{code}</BigNumber>
                <TextLink title="Compartir →" onPress={() => Share.share({ message: `Mi código de Go Unplugged: ${code}` })} />
              </>
            ) : (
              <>
                <Body muted>Alguien que te conozca y quiera ayudarte. Nunca verá tus chats ni publicaciones.</Body>
                {data?.supervised.length ? (
                  <TextLink title="Invitar a alguien con un código →" onPress={invite} />
                ) : (
                  <Button title="Invitar con un código" onPress={invite} />
                )}
              </>
            )}
          </View>
        )}
      </Section>

      {joining ? (
        <View style={{ gap: space.md }}>
          <Field label="Código que te dieron" value={inputCode} onChangeText={(t) => setInputCode(t.toUpperCase())} autoCapitalize="characters" maxLength={8} />
          <Button title="Unirme" variant="secondary" onPress={join} disabled={inputCode.length !== 8} />
        </View>
      ) : (
        <TextLink title="Me dieron un código" color={c.inkSoft} onPress={() => setJoining(true)} />
      )}
    </Screen>
  );
}
