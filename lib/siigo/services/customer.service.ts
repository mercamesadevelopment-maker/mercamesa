import { siigoFetch } from '../client';
import {
  SIIGO_DEFAULT_CITY_CODE,
  SIIGO_DEFAULT_COUNTRY_CODE,
  SIIGO_DEFAULT_ID_TYPE,
  SIIGO_DEFAULT_STATE_CODE,
} from '../config';
import type { SiigoCustomer, SiigoCustomerPayload, SiigoCustomersResponse } from '../types';

/** Busca un tercero por número de identificación. `null` si no existe. */
export async function findCustomerByIdentification(
  identification: string
): Promise<SiigoCustomer | null> {
  const response = await siigoFetch<SiigoCustomersResponse>(
    `/v1/customers?identification=${encodeURIComponent(identification)}`
  );

  return response.results?.[0] ?? null;
}

export function createCustomer(payload: SiigoCustomerPayload): Promise<SiigoCustomer> {
  return siigoFetch<SiigoCustomer>('/v1/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Datos del comprador tal como salen de `profiles` y sus catálogos. */
export interface BuyerForSiigo {
  identification: string;
  fullName: string | null;
  businessName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  /** De `identification_types.siigo_id_type`. */
  siigoIdType: string | null;
  /** De `person_types.requires_business_name`. */
  requiresBusinessName: boolean;
  addressLine: string | null;
}

/**
 * Parte un nombre completo en [nombres, apellidos].
 *
 * Siigo exige el nombre de una persona natural como arreglo de exactamente dos
 * posiciones. `profiles` guarda un solo campo, así que se parte por el último
 * espacio; si no hay apellido se repite el nombre, porque un arreglo de una
 * posición hace que Siigo rechace la creación.
 */
function splitPersonName(fullName: string): [string, string] {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return [parts[0], parts[0]];
  if (parts.length === 2) return [parts[0], parts[1]];
  // Con 3 o más: los dos primeros son nombres, el resto apellidos.
  const split = parts.length >= 4 ? 2 : 1;
  return [parts.slice(0, split).join(' '), parts.slice(split).join(' ')];
}

export function buildCustomerPayload(buyer: BuyerForSiigo): SiigoCustomerPayload {
  const isCompany = buyer.requiresBusinessName;
  const displayName = isCompany
    ? buyer.businessName || buyer.fullName || 'Cliente'
    : buyer.fullName || 'Cliente';

  const payload: SiigoCustomerPayload = {
    person_type: isCompany ? 'Company' : 'Person',
    id_type: buyer.siigoIdType || SIIGO_DEFAULT_ID_TYPE,
    identification: buyer.identification,
    name: isCompany ? [displayName] : splitPersonName(displayName),
    branch_office: 0,
    active: true,
    // Los códigos DANE no se pueden derivar: delivery_addresses solo guarda
    // texto libre. Se usa la ciudad por defecto (Medellín) hasta que el cliente
    // confirme cómo quiere resolverlo.
    address: {
      address: buyer.addressLine || 'No registrada',
      city: {
        country_code: SIIGO_DEFAULT_COUNTRY_CODE,
        state_code: SIIGO_DEFAULT_STATE_CODE,
        city_code: SIIGO_DEFAULT_CITY_CODE,
      },
    },
  };

  if (buyer.phone) {
    payload.phones = [{ number: buyer.phone }];
  }

  const contactName = isCompany ? buyer.contactName || displayName : displayName;
  const [firstName, lastName] = splitPersonName(contactName);

  payload.contacts = [
    {
      first_name: firstName,
      last_name: lastName,
      ...(buyer.email && { email: buyer.email }),
      ...(buyer.phone && { phone: { number: buyer.phone } }),
    },
  ];

  return payload;
}

/**
 * Devuelve el tercero, creándolo si no existe.
 *
 * Se busca primero para no chocar con `already_exists`: los 161 terceros que ya
 * están en Siigo vienen de antes de esta integración.
 */
export async function ensureCustomer(buyer: BuyerForSiigo): Promise<SiigoCustomer> {
  const existing = await findCustomerByIdentification(buyer.identification);
  if (existing) return existing;

  return createCustomer(buildCustomerPayload(buyer));
}
