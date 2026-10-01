'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/src/store';

/**
 * «Ayuda y Soporte» lleva a las PQRS de quien entra.
 *
 * Acá había un chat simulado: respondía solo «un agente se conectará pronto» y
 * nada de lo escrito le llegaba a nadie. Las PQRS son el canal de verdad.
 */
const PQRS_POR_ROL: Record<string, string> = {
  admin: '/admin/pqrs',
  provider: '/seller/pqrs',
};

export default function SupportPage() {
  const router = useRouter();
  const { state } = useApp();

  useEffect(() => {
    // Hasta que la sesión termine de cargar no se sabe el rol.
    if (!state._hydrated) return;
    router.replace(PQRS_POR_ROL[state.userRole] ?? '/pqrs');
  }, [state._hydrated, state.userRole, router]);

  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-mm-txw" />
    </div>
  );
}
