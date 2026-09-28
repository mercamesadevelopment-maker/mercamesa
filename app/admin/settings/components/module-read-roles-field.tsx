'use client';

import React from 'react';
import { RoleOption } from '../types/settings.types';
import { cn } from '@/src/components/Shared';

/** Se resaltan porque son los que administran la plataforma entera. */
const ROLES_DE_PLATAFORMA = ['admin', 'superadmin'];

/**
 * «Quién lo ve»: una casilla por rol con la acción `read` sobre el módulo.
 *
 * Solo pinta y avisa; la regla de qué pasa al desmarcar vive en la API.
 */
export function ModuleReadRolesField({
  roles,
  selected,
  onChange,
  lockedRoleName,
}: {
  roles: RoleOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Rol que no se puede desmarcar (el superadmin en Configuración). */
  lockedRoleName?: string | null;
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((r) => r !== id) : [...selected, id]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-mm-txs ml-1">Quién lo ve</label>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-mm-crd p-3">
        {roles.map((rol) => {
          const bloqueado = rol.name === lockedRoleName;
          return (
            <label
              key={rol.id}
              className={cn(
                'flex items-center gap-2 text-sm',
                bloqueado ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              )}
              title={bloqueado ? 'No se puede quitar: nadie podría volver a entrar a Configuración.' : undefined}
            >
              <input
                type="checkbox"
                checked={selected.includes(rol.id)}
                disabled={bloqueado}
                onChange={() => toggle(rol.id)}
                className="w-4 h-4 accent-mm-g rounded"
              />
              <span className={cn(ROLES_DE_PLATAFORMA.includes(rol.name) ? 'font-bold text-mm-g' : 'text-mm-txs')}>
                {rol.label}
              </span>
            </label>
          );
        })}
      </div>

      <p className="text-xs text-mm-txw ml-1">
        Al desmarcar un rol se le quitan también sus demás permisos sobre este módulo.
      </p>
    </div>
  );
}
