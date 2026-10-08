'use client';

import { Share, SquarePlus, CheckCircle2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal/modal';
import { Button } from '@/src/components/Shared';

const STEPS = [
  {
    icon: Share,
    title: 'Toca el botón Compartir',
    text: 'Es el cuadrado con la flecha hacia arriba, en la barra de Safari (abajo en iPhone, arriba en iPad).',
  },
  {
    icon: SquarePlus,
    title: 'Elige «Agregar a pantalla de inicio»',
    text: 'Si no lo ves, desliza la lista de opciones hacia arriba.',
  },
  {
    icon: CheckCircle2,
    title: 'Toca «Agregar»',
    text: 'MercaMesa queda en tu pantalla de inicio y se abre como una app.',
  },
];

interface IosInstallGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Cómo instalar MercaMesa en iPhone o iPad. Safari no deja que un sitio abra
 * el diálogo de instalación por su cuenta, así que solo queda explicarlo.
 */
export function IosInstallGuide({ isOpen, onClose }: IosInstallGuideProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Instala MercaMesa" maxWidth="max-w-md">
      <div className="p-6 space-y-5">
        <p className="text-sm text-mm-txs">
          En iPhone y iPad se instala desde Safari, en tres pasos:
        </p>

        <ol className="space-y-4">
          {STEPS.map(({ icon: Icon, title, text }, idx) => (
            <li key={title} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mm-gbg border border-mm-crd text-mm-g">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="flex items-center gap-1.5 text-sm font-bold text-mm-g">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-mm-g text-[9px] font-black text-white">
                    {idx + 1}
                  </span>
                  {title}
                </p>
                <p className="mt-0.5 text-xs text-mm-txs leading-relaxed">{text}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="text-xs text-mm-txw">
          Si abriste MercaMesa desde otra app (Instagram, WhatsApp), ábrelo primero en Safari.
        </p>

        <Button className="w-full" onClick={onClose}>
          Entendido
        </Button>
      </div>
    </Modal>
  );
}
