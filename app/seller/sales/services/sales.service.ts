import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export interface ClientData {
  id?: string;
  profile_id?: string | null;
  document_number: string;
  /** Tipo de identificación del catálogo. Los clientes creados antes lo tienen en null. */
  identification_type_id?: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
}

export async function searchClientByDocumentOrEmail(query: string): Promise<ClientData | null> {
  if (!query) return null;
  const supabase = createSupabaseBrowserClient();

  // 1. Buscar en la tabla 'clients'
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .or(`document_number.eq.${query},email.eq.${query}`)
    .maybeSingle();

  if (client) {
    return client as ClientData;
  }

  // 2. Si no se encuentra en 'clients', buscar en 'profiles'
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .or(`document_number.eq.${query},email.eq.${query}`)
    .maybeSingle();

  if (profile) {
    return {
      profile_id: profile.id,
      document_number: profile.document_number || '',
      // El comprador ya eligió su tipo al registrarse: se hereda en vez de
      // pedirlo otra vez.
      identification_type_id: profile.identification_type_id || null,
      full_name: profile.full_name || '',
      email: profile.email || null,
      phone: profile.phone || null,
    };
  }

  return null;
}

export async function saveClient(clientData: Omit<ClientData, 'id'>): Promise<ClientData | null> {
  const supabase = createSupabaseBrowserClient();

  // Validar si ya existe en 'clients' para evitar duplicados
  const { data: existing } = await supabase
    .from('clients')
    .select('*')
    .eq('document_number', clientData.document_number)
    .maybeSingle();

  if (existing) {
    return existing as ClientData;
  }

  const { data: inserted, error } = await supabase
    .from('clients')
    .insert({
      profile_id: clientData.profile_id || null,
      document_number: clientData.document_number,
      identification_type_id: clientData.identification_type_id || null,
      full_name: clientData.full_name,
      email: clientData.email || null,
      phone: clientData.phone || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving client:', error.message);
    return null;
  }

  return inserted as ClientData;
}
