'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { cn } from '@/src/components/Shared';
import { useInstallPrompt } from '../hooks/use-install-prompt';
import { IosInstallGuide } from './IosInstallGuide';

interface InstallAppButtonProps {
  /** Menú colapsado: solo el ícono. */
  collapsed?: boolean;
}

/**
 * «Instalar la app», para el menú lateral.
 *
 * No se muestra si ya está instalada o si el navegador no lo permite. En
 * iPhone abre la guía, porque ahí la instalación es manual.
 */
export function InstallAppButton({ collapsed = false }: InstallAppButtonProps) {
  const { mode, install } = useInstallPrompt();
  const [guideOpen, setGuideOpen] = useState(false);

  if (mode === 'none') return null;

  return (
    <>
      <button
        type="button"
        onClick={() => (mode === 'ios' ? setGuideOpen(true) : install())}
        title="Instalar la app"
        className={cn(
          'w-full flex items-center gap-2 py-2.5 mb-3 rounded-xl border border-mm-g/20 bg-mm-gbg/60 text-sm font-bold text-mm-g hover:bg-mm-gbg transition-all',
          collapsed ? 'justify-center px-0' : 'justify-center px-3'
        )}
      >
        <Download className="w-4 h-4 shrink-0" />
        {!collapsed && <span>Instalar la app</span>}
      </button>

      <IosInstallGuide isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
}
