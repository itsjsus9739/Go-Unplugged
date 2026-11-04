import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { decideRequest } from '../services/requests';

/**
 * Al tocar una notificación push:
 *  - botones "Aprobar"/"Denegar" (categoría extension_request) → decide sin abrir pantallas
 *  - toque normal → abre el detalle de la petición
 */
export function useNotificationRouting() {
  const last = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!last) return;
    const data = last.notification.request.content.data as { request_id?: string } | undefined;
    const requestId = data?.request_id;
    if (!requestId) return;

    if (last.actionIdentifier === 'approve' || last.actionIdentifier === 'deny') {
      decideRequest(requestId, last.actionIdentifier === 'approve')
        .catch(() => undefined)
        .finally(() => router.push({ pathname: '/request/[id]', params: { id: requestId } }));
    } else {
      router.push({ pathname: '/request/[id]', params: { id: requestId } });
    }
    Notifications.clearLastNotificationResponse();
  }, [last]);
}
