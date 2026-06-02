import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roleId = searchParams.get('role_id');

  if (!roleId) {
    return NextResponse.json({ error: 'role_id is required' }, { status: 400 });
  }

  const supabase = await createClient();

  // Get modules where the role has the 'read' action (or any action depending on business logic)
  // Since we have a many-to-many relationship, we query role_permissions joining modules
  
  const { data, error } = await supabase
    .from('role_permissions')
    .select(`
      module_id,
      modules (*),
      action_id,
      actions (*)
    `)
    .eq('role_id', roleId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Extract unique modules and aggregate actions per module
  const modulesMap = new Map();
  const permissions: Record<string, string[]> = {};

  data.forEach((rp: any) => {
    const module = rp.modules;
    const action = rp.actions;
    if (module && module.is_active) {
      modulesMap.set(module.id, module);
      
      if (action && action.name) {
        if (!permissions[module.key]) {
          permissions[module.key] = [];
        }
        if (!permissions[module.key].includes(action.name)) {
          permissions[module.key].push(action.name);
        }
      }
    }
  });

  const allowedModules = Array.from(modulesMap.values())
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  return NextResponse.json({ 
    data: {
      modules: allowedModules,
      permissions
    }
  }, { status: 200 });
}
