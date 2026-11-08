import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getMeteorMcpToken } from '@/lib/env';
import { meteorAuthError } from '@/lib/mcp/auth';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { readFeed } from '@/lib/whatsapp-events/feed';
import { parseFeedQuery } from '@/lib/whatsapp-events/rules';

/**
 * Los avisos del pedido que Meteor envía por WhatsApp. Meteor la consulta cada
 * cierto tiempo con `?desde=<siguiente>` (0 la primera vez) y guarda el
 * `siguiente` que recibe. Mismo token que el MCP. Ver `docs/mcp-meteor.md`.
 */
export async function GET(request: Request) {
  const denied = meteorAuthError(request, getMeteorMcpToken());
  if (denied) return denied;

  const query = parseFeedQuery(new URL(request.url).searchParams);
  if ('error' in query) return NextResponse.json({ error: query.error }, { status: 400 });

  try {
    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;
    return NextResponse.json(await readFeed(service, query), { status: 200 });
  } catch (error: unknown) {
    console.error('[meteor/avisos]', error);
    return NextResponse.json({ error: 'No se pudieron leer los avisos. Intenta de nuevo.' }, { status: 500 });
  }
}
