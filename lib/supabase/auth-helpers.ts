import { createClient } from './server';
import { createClient as createJSClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../types/database_generated';

/**
 * Crea una instancia de cliente Supabase utilizando un token de portador (Bearer)
 * para realizar consultas respetando las políticas de seguridad (RLS).
 */
export function createClientWithToken(token: string): SupabaseClient<Database> {
  return createJSClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}

/**
 * Autentica una solicitud de API y retorna el cliente de Supabase correspondiente
 * y los detalles del usuario. Soporta tanto cabeceras de autorización Bearer como cookies.
 */
export async function getAuthenticatedClient(request: Request) {
  const authHeader = request.headers.get('Authorization');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (!token) {
      return { supabase: null, user: null, error: 'Unauthorized: Empty token' };
    }
    
    const supabase = createClientWithToken(token);
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return { supabase: null, user: null, error: 'Unauthorized: Invalid token' };
    }
    
    return { supabase, user, error: null };
  }

  // Caer en validación basada en cookies (para sesiones internas)
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return { supabase: null, user: null, error: 'Unauthorized: No session' };
    }
    
    return { supabase, user, error: null };
  } catch (err: any) {
    return { supabase: null, user: null, error: `Unauthorized: ${err.message}` };
  }
}

/**
 * Verifica si un usuario autenticado posee permisos de lectura u otras acciones
 * en un módulo específico a través del sistema RBAC de la base de datos.
 */
export async function verifyPermission(
  supabase: SupabaseClient<Database>,
  userId: string,
  moduleKey: string,
  actionName: string = 'read'
): Promise<boolean> {
  // 1. Obtener el perfil del usuario para encontrar su role_id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role_id')
    .eq('id', userId)
    .single();

  if (profileError || !profile || !profile.role_id) {
    console.error('Error fetching user profile or role:', profileError);
    return false;
  }

  // 2. Obtener información del rol para verificar si es system o admin
  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('name, is_system')
    .eq('id', profile.role_id)
    .single();

  if (roleError || !role) {
    console.error('Error fetching role details:', roleError);
    return false;
  }

  if (role.is_system || role.name === 'admin') {
    return true; // Bypass para administradores o roles de sistema
  }

  // 3. Buscar si existe el permiso asociado en role_permissions para la llave del módulo
  const { data: permission, error: permError } = await supabase
    .from('role_permissions')
    .select(`
      id,
      modules!inner(key, is_active),
      actions!inner(name)
    `)
    .eq('role_id', profile.role_id)
    .eq('modules.key', moduleKey)
    .eq('modules.is_active', true)
    .eq('actions.name', actionName)
    .maybeSingle();

  if (permError) {
    console.error('Error querying role_permissions:', permError);
    return false;
  }

  return !!permission;
}
