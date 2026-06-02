'use client';

import React, { ReactNode } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { useApp } from '@/src/store';

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
  const { state } = useApp();
  const roleId = state.buyerProfile?.role_id;

  const { hasPermission, loading } = usePermissions(
    roleId,
    state._hydrated
  );

  if (loading) {
    return null; // O un esqueleto si fuera necesario
  }

  if (hasPermission(module, action)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
