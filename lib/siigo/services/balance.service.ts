import { siigoFetch } from '../client';
import type { SiigoTestBalancePayload, SiigoTestBalanceResponse } from '../types';

/**
 * Los balances de prueba de Siigo. Siigo arma el reporte y devuelve un enlace al
 * Excel; en Siigo solo se lee, no se crea ni se cambia nada.
 */

/** Si este entorno tiene credenciales de Siigo. Hoy solo producción. */
export function isSiigoConfigured(): boolean {
  return Boolean(process.env.SIIGO_USERNAME && process.env.SIIGO_ACCESS_KEY);
}

/** El balance de prueba general de la empresa. */
export function generateTestBalance(payload: SiigoTestBalancePayload): Promise<SiigoTestBalanceResponse> {
  const { customer: _sinTercero, ...general } = payload;
  return siigoFetch<SiigoTestBalanceResponse>('/v1/test-balance-report', {
    method: 'POST',
    body: JSON.stringify(general),
  });
}

/** El balance de prueba de un tercero (`payload.customer`). */
export function generateTestBalanceByThirdParty(payload: SiigoTestBalancePayload): Promise<SiigoTestBalanceResponse> {
  return siigoFetch<SiigoTestBalanceResponse>('/v1/test-balance-report-by-thirdparty', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
