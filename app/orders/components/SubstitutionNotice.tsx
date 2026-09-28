import { AlertTriangle } from 'lucide-react';

/**
 * Cómo se resuelve un producto que el tendero no consigue.
 *
 * Va una sola vez arriba de la lista y no dentro de `OrderCard`: son cuatro
 * frases y la página muestra hasta cinco pedidos, así que en la tarjeta se
 * repetiría cinco veces.
 *
 * Es informativo: no se pide aceptarlo ni queda constancia de que se leyó. Si
 * alguna vez hace falta eso, el camino es `legal_documents` con `LegalGate`.
 */
export function SubstitutionNotice() {
  return (
    <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-3xl sm:rounded-[32px] p-4 sm:p-6 mb-4 sm:mb-6">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />

      <div className="text-xs text-amber-900 leading-relaxed">
        <p className="font-bold mb-1">Si algún producto no está disponible</p>

        <p>
          El tendero hará su mejor esfuerzo para surtir el pedido utilizando su
          propio inventario o el de otros tenderos de la plaza. Si algún producto
          no está disponible, se comunicará con nosotros para contactarlo y
          definir una alternativa de sustitución. Ningún producto podrá ser
          reemplazado por otro sin la autorización previa y expresa del cliente.
          Solo se realizarán sustituciones cuando el comprador haya otorgado su
          consentimiento.
        </p>
      </div>
    </div>
  );
}
