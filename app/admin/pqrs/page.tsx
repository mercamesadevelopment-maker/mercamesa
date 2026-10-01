'use client';

import React from 'react';
import { PqrsView } from '@/src/features/pqrs/components/PqrsView';

export default function AdminPqrsPage() {
  return (
    <PqrsView
      scope="admin"
      title="PQRS"
      subtitle="Todos los casos de compradores y tiendas. Los que están «en revisión» esperan tu decisión."
    />
  );
}
