import type { Database } from '@/types/database_generated';

/**
 * Tipos de la API de Pibox (docs/picap.MD).
 *
 * OJO con la asimetría del dinero: en los REQUEST viaja como
 * `{ sub_units, currency }` y en las RESPONSE como `{ subunits, iso }`.
 * Verificado contra la API real con POST /third/bookings/eta.
 */

export interface PiboxMoneyRequest {
  sub_units: number;
  currency: string;
}

export interface PiboxMoneyResponse {
  subunits: number;
  iso: string;
}

export interface PiboxCustomer {
  name: string;
  email?: string;
  country_code: string;
  phone: string;
  fiscal_number?: string;
}

export interface PiboxPackageRequest {
  indications: string;
  declared_value: PiboxMoneyRequest;
  reference: string;
  counter_delivery: boolean;
  /** Obligatorio si counter_delivery es true; si no, va null */
  collected_value?: PiboxMoneyRequest | null;
  size_cd: number;
}

export interface PiboxStopRequest {
  address: string;
  secondary_address?: string;
  lat?: number;
  lon?: number;
  customer?: PiboxCustomer;
  packages: PiboxPackageRequest[];
}

export interface PiboxBookingRequest {
  address: string;
  secondary_address?: string;
  lat?: number;
  lon?: number;
  sender_phone?: string;
  sender_country_code?: string;
  client_identification?: string;
  requested_service_type_id: string;
  return_to_origin: boolean;
  requires_a_driver_with_base_money: boolean;
  money_to_pay_for_package?: PiboxMoneyRequest | null;
  scheduled_at?: string | null;
  /** Necesario cuando alguna dirección va sin lat/lon (geocodificación) */
  city_code?: string;
  cost_center_id?: string | null;
  stops: PiboxStopRequest[];
}

/** POST /bookings y POST /bookings/eta reciben el payload envuelto en `booking` */
export interface PiboxBookingEnvelope {
  booking: PiboxBookingRequest;
}

export interface PiboxEtaResponse {
  fare: PiboxMoneyResponse;
  /** Milisegundos */
  estimate_arrival: number;
  /** Campo no documentado, presente en la respuesta real */
  flat_rate_amount?: number | null;
}

export interface PiboxDriver {
  name: string;
  phone: string;
}

export interface PiboxVehicle {
  plates?: string;
  color?: string;
  make?: string;
  reference?: string;
}

export interface PiboxPackageResponse {
  _id: string;
  indications: string | null;
  declared_value: PiboxMoneyResponse | null;
  reference: string | null;
  counter_delivery: boolean;
  size_cd: number;
  status_cd: number;
  tracking_link: string | null;
  picked_up_photo_url: string | null;
  delivered_photo_url: string | null;
  canceled_pickup_reason_cd: number | null;
  not_received_reason_cd: number | null;
  events?: { _id: string; created_at: string; status_cd: number }[];
  has_retry_attempt?: boolean;
  relaunched_to_id?: string | null;
  validation_code?: string | null;
}

export interface PiboxStopResponse {
  address: string;
  secondary_address?: string | null;
  address_geojson?: { type: string; coordinates: number[] } | null;
  customer?: PiboxCustomer | null;
  finished: boolean;
  is_return_stop: boolean;
  packages: PiboxPackageResponse[];
}

export interface PiboxBookingResponse {
  _id: string;
  created_at: string;
  address: string;
  secondary_address?: string | null;
  origin_geojson?: { type: string; coordinates: number[] } | null;
  requested_service_type_id: string;
  status_cd: number;
  estimated_cost?: PiboxMoneyResponse | null;
  final_cost?: PiboxMoneyResponse | null;
  trv_distance_str?: string | null;
  driver?: PiboxDriver | null;
  served_vehicle?: PiboxVehicle | null;
  relaunched_to_id?: string | null;
  original_booking_id?: string | null;
  estimated_traveled_distance?: number | null;
  scheduled_at?: string | null;
  pickup_validation_code?: string | null;
  stops: PiboxStopResponse[];
}

/** Webhook event_cd 0 — actualización de estado de un pedido */
export interface PiboxBookingWebhookPayload {
  booking_id: string;
  status_cd: number;
  event_cd: 0;
  created_at: string;
  relaunched_to_id?: string | null;
  driver?: (PiboxDriver & { id?: string }) | null;
  vehicle?: PiboxVehicle | null;
}

/** Webhook event_cd 1 — actualización de estado de un paquete */
export interface PiboxPackageWebhookPayload {
  package_id: string;
  status_cd: number;
  event_cd: 1;
  created_at: string;
}

export type PiboxWebhookPayload =
  | PiboxBookingWebhookPayload
  | PiboxPackageWebhookPayload;

export interface PiboxHook {
  _id: string;
  url: string;
  event_cd: number;
  headers: Record<string, string>;
}

// ── Tabla pibox_bookings ───────────────────────────────────────────────────
// Derivados de los tipos generados por Supabase.

export type PiboxBookingRow = Database['public']['Tables']['pibox_bookings']['Row'];
export type PiboxBookingInsert = Database['public']['Tables']['pibox_bookings']['Insert'];
export type PiboxBookingUpdate = Database['public']['Tables']['pibox_bookings']['Update'];
