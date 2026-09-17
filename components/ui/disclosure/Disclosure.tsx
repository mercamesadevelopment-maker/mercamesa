'use client';

import React, { useId, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/src/components/Shared';

interface DisclosureProps {
  /** Texto del botón que abre y cierra. */
  label: string;
  children: React.ReactNode;
  /** Arranca abierto. Por defecto `false`, que es el punto de usar esto. */
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Bloque de texto plegable.
 *
 * Para contenido largo pero secundario —avisos legales, recomendaciones— que
 * debe estar disponible sin ocupar media pantalla. Quien quiere leerlo lo abre;
 * quien no, sigue viendo el botón que importa.
 *
 * No había ninguno reutilizable: `Sidebar` y `Table` resuelven lo suyo por
 * dentro, sin exponerlo.
 */
export function Disclosure({ label, children, defaultOpen = false, className }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  // `useId` y no un contador: el mismo Disclosure puede montarse varias veces y
  // `aria-controls` tiene que apuntar a un id único de verdad.
  const contentId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex items-center gap-1 font-bold text-mm-g hover:text-mm-gl transition-colors"
      >
        {label}
        <ChevronDown
          className={cn('w-3.5 h-3.5 shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={contentId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
