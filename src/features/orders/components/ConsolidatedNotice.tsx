import { ShoppingBag } from 'lucide-react';
import { carrierOf, receiverOf, type ConsolidationConfig } from '@/lib/orders/consolidation';

/**
 * Aviso al tendero en un pedido de varias tiendas: qué tiene que hacer con su
 * parte, según cómo opera la plaza. En ningún caso pide el domicilio: sale un
 * solo mensajero desde la bahía.
 */
export function ConsolidatedNotice({ config }: { config: ConsolidationConfig }) {
  const carrier = carrierOf(config);
  const receiver = receiverOf(config);

  const queHacer =
    carrier === 'runner'
      ? 'Alista tu parte y márcala como «Listo Recogida»: el patinador pasa por tu local y la lleva a la bahía.'
      : receiver === 'logistics'
        ? 'Alista tu parte, márcala como «Listo Recogida» y llévala a la bahía: allí la recibe logística.'
        : 'Alista tu parte, márcala como «Listo Recogida» y entrégasela al domiciliario cuando llegue a la plaza.';

  return (
    <div className="flex items-start gap-2.5 bg-mm-gbg/40 border border-mm-crd/60 rounded-2xl p-4">
      <ShoppingBag className="w-4 h-4 shrink-0 mt-0.5 text-mm-g" />
      <p className="text-xs text-mm-txs leading-relaxed">
        <span className="font-bold text-mm-g">Pedido compartido con otras tiendas de la plaza.</span> {queHacer}{' '}
        Sale un solo mensajero para todo el pedido: no tienes que pedir el domicilio. Cuenta cómo va empacada tu
        parte en «¿Cómo va empacado?».
      </p>
    </div>
  );
}
