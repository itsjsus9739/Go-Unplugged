import { View } from 'react-native';

import { formatMinutes, minutesLeft, timeAgo } from '../lib/format';
import type { ExtensionRequest, RequestStatus } from '../types/database';
import { Badge, Body, Card, Eyebrow, Heading, Row } from './ui';

const STATUS: Record<RequestStatus, { label: string; tone: 'warning' | 'success' | 'danger' | 'neutral' }> = {
  pending: { label: 'Pendiente', tone: 'warning' },
  approved: { label: 'Aprobada', tone: 'success' },
  denied: { label: 'Límite mantenido', tone: 'danger' },
  expired: { label: 'Expirada', tone: 'neutral' },
  cancelled: { label: 'Cancelada', tone: 'neutral' },
};

const KIND_LABEL = {
  time_extension: 'Petición de tiempo',
  emergency: 'Urgencia',
  rule_relax: 'Cambio de límite',
  disable_protection: 'Desactivar protección',
} as const;

/** Tarjeta inspirada en la de la landing: "Petición de tiempo · Instagram · 15 min extra". */
export function RequestCard({
  request,
  requesterName,
  children,
}: {
  request: ExtensionRequest;
  requesterName?: string;
  children?: React.ReactNode;
}) {
  const s = STATUS[request.status];
  const active = request.status === 'approved' && request.grant_ends_at && minutesLeft(request.grant_ends_at) > 0;
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Eyebrow>{KIND_LABEL[request.kind]}</Eyebrow>
        <Badge label={s.label} tone={s.tone} />
      </Row>
      <Heading>
        {request.target_name ?? 'Todas las apps'}
        {request.minutes_requested ? ` · ${formatMinutes(request.minutes_requested)} extra` : ''}
      </Heading>
      {request.reason ? <Body muted>“{request.reason}”</Body> : null}
      <View style={{ gap: 2 }}>
        {requesterName ? <Body muted>Solicitado por {requesterName}</Body> : null}
        <Body muted>{timeAgo(request.created_at)}</Body>
        {active ? <Body>Quedan {minutesLeft(request.grant_ends_at!)} min del tiempo aprobado</Body> : null}
        {request.decision_note ? <Body muted>Nota del socio: “{request.decision_note}”</Body> : null}
      </View>
      {children}
    </Card>
  );
}
