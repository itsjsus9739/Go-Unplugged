/**
 * Tipos de la base de datos de Supabase.
 *
 * Escritos a mano a partir de supabase/migrations/*. Cuando el proyecto esté
 * enlazado, regenéralos con:  npm run gen:types
 * (supabase gen types typescript --linked --schema public)
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamp = string;

export type Platform = 'android' | 'ios';
export type PlanTier = 'free' | 'individual' | 'pareja' | 'familiar';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
export type InvitationRole = 'monitored' | 'partner';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type PartnershipStatus = 'active' | 'revoking' | 'revoked';
export type RequestKind = 'time_extension' | 'emergency' | 'rule_relax' | 'disable_protection';
export type RequestStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'cancelled';
export type TargetType = 'app' | 'category' | 'web_domain';
export type DeviceEventType =
  | 'protection_enabled'
  | 'protection_disabled'
  | 'permission_revoked'
  | 'uninstall_attempt'
  | 'limit_reached'
  | 'pin_verified'
  | 'pin_failed';

export type Plan = {
  tier: PlanTier;
  name: string;
  price_usd_month: number;
  max_monitored: number;
  max_partners: number;
  features: Json;
  is_public: boolean;
  sort_order: number;
  /** null = ilimitadas */
  max_apps: number | null;
  /** null = historial completo */
  history_days: number | null;
  weekly_reports: boolean;
  family_panel: boolean;
  /** El plan cubre a las personas que el titular acompaña (Pareja/Familiar). */
  covers_partners: boolean;
};

/** Resultado de la RPC my_plan(). */
export type MyPlan = {
  tier: PlanTier;
  own_tier: PlanTier;
  /** free | own | trial | partner (cubierto por el plan de un socio) */
  source: 'free' | 'own' | 'trial' | 'partner';
  status: SubscriptionStatus | null;
  provider: string | null;
  current_period_end: Timestamp | null;
  trial_available: boolean;
  apps_used: number;
  plan: Plan;
};

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  timezone: string;
  locale: string;
  onboarding_completed: boolean;
  emergency_unlocks_per_month: number;
  emergency_unlock_minutes: number;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type Subscription = {
  id: string;
  user_id: string;
  tier: PlanTier;
  status: SubscriptionStatus;
  provider: string;
  provider_ref: string | null;
  current_period_end: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type Device = {
  id: string;
  user_id: string;
  install_id: string;
  platform: Platform;
  name: string | null;
  model: string | null;
  os_version: string | null;
  app_version: string | null;
  push_token: string | null;
  protection_enabled: boolean;
  permissions: Json;
  last_seen_at: Timestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type PartnerInvitation = {
  id: string;
  inviter_id: string;
  inviter_role: InvitationRole;
  code: string;
  status: InvitationStatus;
  accepted_by: string | null;
  accepted_at: Timestamp | null;
  expires_at: Timestamp;
  created_at: Timestamp;
};

export type Partnership = {
  id: string;
  monitored_id: string;
  partner_id: string;
  status: PartnershipStatus;
  invitation_id: string | null;
  partner_pin_hash: string | null;
  revoke_requested_at: Timestamp | null;
  revoke_effective_at: Timestamp | null;
  revoked_by: string | null;
  revoked_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type LimitRule = {
  id: string;
  user_id: string;
  name: string;
  daily_limit_minutes: number;
  active_days: number[];
  block_start: string | null;
  block_end: string | null;
  is_active: boolean;
  updated_by: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type RuleTarget = {
  id: string;
  rule_id: string;
  user_id: string;
  platform: Platform | null;
  target_type: TargetType;
  identifier: string;
  display_name: string;
  device_id: string | null;
  created_at: Timestamp;
};

export type ExtensionRequest = {
  id: string;
  requester_id: string;
  device_id: string | null;
  rule_id: string | null;
  kind: RequestKind;
  target_identifier: string | null;
  target_name: string | null;
  minutes_requested: number | null;
  reason: string | null;
  payload: Json;
  status: RequestStatus;
  decided_by: string | null;
  decided_at: Timestamp | null;
  decision_note: string | null;
  minutes_granted: number | null;
  grant_starts_at: Timestamp | null;
  grant_ends_at: Timestamp | null;
  expires_at: Timestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type ActiveGrant = Pick<
  ExtensionRequest,
  | 'id'
  | 'requester_id'
  | 'device_id'
  | 'rule_id'
  | 'kind'
  | 'target_identifier'
  | 'target_name'
  | 'minutes_granted'
  | 'grant_starts_at'
  | 'grant_ends_at'
>;

export type UsageDaily = {
  device_id: string;
  user_id: string;
  usage_date: string;
  identifier: string;
  display_name: string | null;
  minutes_used: number;
  opens: number;
  updated_at: Timestamp;
};

export type DeviceEvent = {
  id: number;
  user_id: string;
  device_id: string | null;
  type: DeviceEventType;
  data: Json;
  created_at: Timestamp;
};

export type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Json;
  read_at: Timestamp | null;
  push_sent_at: Timestamp | null;
  created_at: Timestamp;
};

/** Insert: columnas con default (o generadas) pasan a opcionales. */
type Ins<T, Required extends keyof T> = Pick<T, Required> & Partial<Omit<T, Required>>;

type Table<Row, Insert, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      plans: Table<Plan, Plan>;
      profiles: Table<Profile, Ins<Profile, 'id'>>;
      subscriptions: Table<Subscription, Ins<Subscription, 'user_id' | 'tier'>>;
      devices: Table<Device, Ins<Device, 'user_id' | 'install_id' | 'platform'>>;
      partner_invitations: Table<PartnerInvitation, Ins<PartnerInvitation, 'inviter_id' | 'code'>>;
      partnerships: Table<Partnership, Ins<Partnership, 'monitored_id' | 'partner_id'>>;
      limit_rules: Table<LimitRule, Ins<LimitRule, 'user_id' | 'name'>>;
      rule_targets: Table<RuleTarget, Ins<RuleTarget, 'rule_id' | 'user_id' | 'identifier' | 'display_name'>>;
      extension_requests: Table<ExtensionRequest, Ins<ExtensionRequest, 'requester_id'>>;
      usage_daily: Table<UsageDaily, Ins<UsageDaily, 'device_id' | 'user_id' | 'usage_date' | 'identifier'>>;
      device_events: Table<DeviceEvent, Ins<DeviceEvent, 'user_id' | 'type'>>;
      notifications: Table<AppNotification, Ins<AppNotification, 'user_id' | 'type' | 'title' | 'body'>>;
    };
    Views: {
      active_grants: { Row: ActiveGrant; Relationships: [] };
    };
    Functions: {
      create_invitation: { Args: { p_inviter_role?: InvitationRole }; Returns: PartnerInvitation };
      accept_invitation: { Args: { p_code: string }; Returns: Partnership };
      revoke_partnership: { Args: { p_partnership_id: string }; Returns: Partnership };
      set_partner_pin: { Args: { p_partnership_id: string; p_pin: string }; Returns: undefined };
      verify_partner_pin: { Args: { p_pin: string; p_device_id?: string }; Returns: boolean };
      request_extension: {
        Args: {
          p_kind?: RequestKind;
          p_minutes?: number;
          p_reason?: string;
          p_rule_id?: string;
          p_target_identifier?: string;
          p_target_name?: string;
          p_device_id?: string;
          p_payload?: Json;
        };
        Returns: ExtensionRequest;
      };
      decide_request: {
        Args: { p_request_id: string; p_approve: boolean; p_minutes_granted?: number; p_note?: string };
        Returns: ExtensionRequest;
      };
      cancel_request: { Args: { p_request_id: string }; Returns: ExtensionRequest };
      my_plan: { Args: Record<string, never>; Returns: Json };
      start_trial: { Args: { p_tier: PlanTier }; Returns: Json };
      is_partner_of: { Args: { p_monitored: string }; Returns: boolean };
      has_active_partner: { Args: { p_user: string }; Returns: boolean };
    };
    Enums: {
      platform: Platform;
      plan_tier: PlanTier;
      subscription_status: SubscriptionStatus;
      invitation_role: InvitationRole;
      invitation_status: InvitationStatus;
      partnership_status: PartnershipStatus;
      request_kind: RequestKind;
      request_status: RequestStatus;
      target_type: TargetType;
      device_event_type: DeviceEventType;
    };
    CompositeTypes: Record<string, never>;
  };
};
