import type { SupabaseClient } from '@supabase/supabase-js';

/** El cliente de una venta de mostrador, como lo usa la pantalla de ventas. */
export interface SaleClient {
  id?: string;
  profile_id?: string | null;
  document_number: string;
  /** Tipo de identificación del catálogo. Los clientes creados antes lo tienen en null. */
  identification_type_id?: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
}

const CLIENT_COLUMNS = 'id, profile_id, document_number, identification_type_id, full_name, email, phone';

/**
 * Busca a quien compra en el mostrador por documento o correo exactos: primero
 * entre los clientes registrados por las tiendas y, si no está, entre los
 * compradores con cuenta (así no se le vuelven a pedir los datos).
 *
 * Recibe el cliente de servicio: devuelve datos de otra persona, así que quien
 * llama ya comprobó que es de una tienda. Solo responde la coincidencia exacta,
 * nunca una lista.
 */
export async function findSaleClient(service: SupabaseClient<any>, query: string): Promise<SaleClient | null> {
  const q = query.trim();
  if (!q) return null;
  const campo = q.includes('@') ? 'email' : 'document_number';
  const valor = q;

  const { data: client } = await service
    .from('clients')
    .select(CLIENT_COLUMNS)
    .eq(campo, valor)
    .limit(1)
    .maybeSingle();
  if (client) return client as SaleClient;

  const { data: profile } = await service
    .from('profiles')
    .select('id, document_number, identification_type_id, full_name, email, phone')
    .eq(campo, valor)
    .limit(1)
    .maybeSingle();
  if (!profile) return null;

  return {
    profile_id: profile.id,
    document_number: profile.document_number || '',
    // El comprador ya eligió su tipo al registrarse: se hereda en vez de pedirlo otra vez.
    identification_type_id: profile.identification_type_id || null,
    full_name: profile.full_name || '',
    email: profile.email || null,
    phone: profile.phone || null,
  };
}

/** Registra al cliente de una venta de mostrador, o devuelve el que ya existe con ese documento. */
export async function saveSaleClient(service: SupabaseClient<any>, input: SaleClient): Promise<SaleClient> {
  const { data: existing } = await service
    .from('clients')
    .select(CLIENT_COLUMNS)
    .eq('document_number', input.document_number)
    .limit(1)
    .maybeSingle();
  if (existing) return existing as SaleClient;

  const { data, error } = await service
    .from('clients')
    .insert({
      profile_id: input.profile_id || null,
      document_number: input.document_number,
      identification_type_id: input.identification_type_id || null,
      full_name: input.full_name,
      email: input.email || null,
      phone: input.phone || null,
    })
    .select(CLIENT_COLUMNS)
    .single();
  if (error) throw error;
  return data as SaleClient;
}
