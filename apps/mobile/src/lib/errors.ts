/** Traduce los errores de las funciones RPC (snake_case) a mensajes para el usuario. */
const MESSAGES: Record<string, string> = {
  not_authenticated: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  invitation_not_found: 'No encontramos ese código. Revísalo e intenta de nuevo.',
  invitation_not_pending: 'Ese código ya se usó o fue cancelado.',
  invitation_expired: 'Ese código expiró. Pide uno nuevo.',
  cannot_accept_own_invitation: 'No puedes aceptar tu propia invitación.',
  already_partners: 'Ya tienen un acuerdo activo.',
  partner_plan_limit: 'Tu socio alcanzó el número máximo de personas de su plan.',
  monitored_plan_limit: 'Alcanzaste el número máximo de socios de tu plan.',
  too_many_pending_invitations: 'Tienes demasiadas invitaciones abiertas. Cancela alguna primero.',
  partnership_not_found: 'Ese acuerdo ya no existe.',
  no_active_partner: 'Primero necesitas un socio de confianza.',
  rule_not_found: 'Esa regla ya no existe.',
  device_not_found: 'Este dispositivo no está registrado.',
  emergency_quota_exhausted: 'Ya usaste tus desbloqueos de urgencia de este mes.',
  rule_required: 'Elige la regla que quieres cambiar.',
  invalid_payload: 'El cambio solicitado no es válido.',
  minutes_required: 'Indica cuántos minutos necesitas.',
  request_not_found: 'Esa petición ya no existe.',
  request_not_pending: 'Esa petición ya fue respondida.',
  request_expired: 'La petición expiró antes de una respuesta.',
  rule_relax_requires_partner: 'Para aflojar un límite necesitas la aprobación de tu socio.',
  invalid_pin: 'El PIN debe tener entre 4 y 8 dígitos.',
  too_many_attempts: 'Demasiados intentos. Espera unos minutos.',
};

export function errorCode(error: unknown): string | null {
  const msg = (error as { message?: string } | null)?.message ?? '';
  return Object.keys(MESSAGES).find((k) => msg.includes(k)) ?? null;
}

export function friendlyError(error: unknown): string {
  const code = errorCode(error);
  if (code) return MESSAGES[code];
  const msg = (error as { message?: string } | null)?.message;
  return msg || 'Algo salió mal. Intenta de nuevo.';
}

/** Lanza si la respuesta de supabase-js trae error; devuelve data tipada. */
export function unwrap<T>(res: { data: T; error: unknown }): NonNullable<T> {
  if (res.error) throw res.error;
  return res.data as NonNullable<T>;
}
