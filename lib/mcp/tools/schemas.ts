import { z } from 'zod';

/** El teléfono de quien escribe, tal como lo recibe Meteor de WhatsApp. */
export const telefono = z
  .string()
  .min(7)
  .max(30)
  .describe('Teléfono de quien escribe por WhatsApp, con indicativo (+573001234567) o sin él (3001234567).');

export const pagina = z.number().int().min(1).optional().describe('Página, desde 1. Por defecto, la 1.');
