import { Crosshair, Hand, Search } from 'lucide-react';
import { Disclosure } from '@/components/ui/disclosure/Disclosure';

const STEPS = [
  {
    icon: Search,
    title: 'Busca tu dirección',
    text: 'Escríbela con el municipio, por ejemplo «Calle 78 sur 40-211, Sabaneta», y elige la sugerencia.',
  },
  {
    icon: Crosshair,
    title: 'O usa tu ubicación',
    text: 'Si estás en el lugar de entrega, toca «Usar mi ubicación» y acepta el permiso del navegador.',
  },
  {
    icon: Hand,
    title: 'Ajusta el pin',
    text: 'Arrástralo hasta tu puerta o portería. También puedes tocar el mapa en el punto exacto.',
  },
];

interface MapLocationGuideProps {
  /** Arranca abierta. Se pasa `false` cuando la dirección ya tiene punto. */
  defaultOpen: boolean;
}

/**
 * Cómo marcar la ubicación en el mapa, en tres pasos.
 *
 * El punto es lo que lleva al mensajero a la puerta, y no todos los compradores
 * saben que el pin se puede arrastrar: sin esto, muchos dejaban el que puso el
 * buscador, que a veces cae en la mitad de la cuadra.
 */
export function MapLocationGuide({ defaultOpen }: MapLocationGuideProps) {
  return (
    <div className="rounded-2xl border border-mm-crd bg-mm-gbg/30 px-4 py-3 text-xs">
      <Disclosure label="¿Cómo marco mi ubicación?" defaultOpen={defaultOpen}>
        <ol className="mt-3 space-y-2.5">
          {STEPS.map(({ icon: Icon, title, text }, idx) => (
            <li key={title} className="flex items-start gap-3">
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-mm-g border border-mm-crd">
                <Icon className="h-4 w-4" />
                <span className="absolute -top-1.5 -left-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-mm-g text-[9px] font-black text-white">
                  {idx + 1}
                </span>
              </span>
              <div>
                <p className="font-bold text-mm-g">{title}</p>
                <p className="text-mm-txs leading-relaxed">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Disclosure>
    </div>
  );
}
