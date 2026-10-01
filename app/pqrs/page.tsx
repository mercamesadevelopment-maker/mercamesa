'use client';

import React from 'react';
import { PqrsView } from '@/src/features/pqrs/components/PqrsView';

export default function BuyerPqrsPage() {
  return (
    <PqrsView
      scope="buyer"
      title="PQRS"
      subtitle="Tus peticiones, quejas, reclamos y sugerencias, y lo que te hemos respondido."
    />
  );
}
