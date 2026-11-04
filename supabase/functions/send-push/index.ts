// Go Unplugged — Edge Function: send-push
// ---------------------------------------------------------------------------
// Se dispara con un Database Webhook (INSERT en public.notifications) y envía
// la notificación a todos los dispositivos del usuario vía Expo Push API.
//
// Configuración (Dashboard → Database → Webhooks):
//   Tabla: public.notifications · Evento: INSERT · Tipo: Supabase Edge Function
//   Función: send-push · Header: x-webhook-secret: <PUSH_WEBHOOK_SECRET>
// Secrets: supabase secrets set PUSH_WEBHOOK_SECRET=... (EXPO_ACCESS_TOKEN opcional)
import { createClient } from 'npm:@supabase/supabase-js@2';

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: NotificationRow | null;
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }

  const payload = (await req.json()) as WebhookPayload;
  const n = payload.record;
  if (payload.type !== 'INSERT' || payload.table !== 'notifications' || !n) {
    return new Response('ignored', { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data: devices, error } = await supabase
    .from('devices')
    .select('id, push_token')
    .eq('user_id', n.user_id)
    .not('push_token', 'is', null);

  if (error) return new Response(error.message, { status: 500 });
  if (!devices?.length) return new Response('no devices', { status: 200 });

  const messages = devices.map((d) => ({
    to: d.push_token,
    title: n.title,
    body: n.body,
    sound: 'default',
    priority: 'high',
    channelId: n.type === 'request_created' ? 'requests' : 'default',
    categoryId: n.type === 'request_created' ? 'extension_request' : undefined,
    data: { ...n.data, notification_id: n.id, type: n.type },
  }));

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
  };
  const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (expoToken) headers.authorization = `Bearer ${expoToken}`;

  const res = await fetch(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(messages) });
  const result = await res.json();

  // Limpia tokens inválidos (app desinstalada / permiso revocado).
  const tickets: Array<{ status: string; details?: { error?: string } }> = result?.data ?? [];
  const dead = tickets
    .map((t, i) => (t.details?.error === 'DeviceNotRegistered' ? devices[i].id : null))
    .filter((id): id is string => id !== null);
  if (dead.length) {
    await supabase.from('devices').update({ push_token: null }).in('id', dead);
  }

  await supabase.from('notifications').update({ push_sent_at: new Date().toISOString() }).eq('id', n.id);

  return new Response(JSON.stringify({ sent: messages.length, dead: dead.length }), {
    headers: { 'content-type': 'application/json' },
  });
});
