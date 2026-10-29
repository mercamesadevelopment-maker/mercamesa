'use client';

import React, { ReactNode } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { useSession } from '@/features/auth/session-context';

interface HasPermissionProps {
  module: string;
  action: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function HasPermission({
  module,
  action,
  children,
  fallback = null,
}: HasPermissionProps) {
  const session = useSession();
  const roleId = session.profile?.role_id;

  const { hasPermission, loading } = usePermissions(
    roleId,
    session.hydrated
  );

  if (loading) {
    return null; // O un esqueleto si fuera necesario
  }

  if (hasPermission(module, action)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
