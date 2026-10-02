import { Badge, cn } from "@/src/components/Shared";
import { fmt } from "@/src/constants";
import { LINE_SAVINGS_LABEL } from "@/lib/copy/discount-notice";
import { discountPct } from "../utils/cart-savings";

interface CartItemPriceProps {
  /** Lo que se cobra por unidad. */
  price: number;
  unit: string;
  /** El precio antes de la oferta. Sin él, o si no es mayor, no hay descuento. */
  listPrice?: number;
  /** Lo ahorrado en la línea, por la cantidad que lleva. */
  savings?: number;
}

/**
 * El precio de un producto en la canasta.
 *
 * Con oferta se ve igual que en la tarjeta del producto —porcentaje, precio de
 * lista tachado y el rebajado en rojo—, para que el comprador reconozca en la
 * canasta el mismo descuento que lo hizo agregarlo.
 */
export function CartItemPrice({ price, unit, listPrice, savings = 0 }: CartItemPriceProps) {
  const hasDiscount = listPrice != null && listPrice > price;

  return (
    <div className="min-w-0">
      {hasDiscount && (
        <div className="mb-0.5 flex items-center gap-1.5">
          <Badge variant="error" className="px-1.5 py-0 text-[10px] font-bold">
            -{discountPct(listPrice, price)}%
          </Badge>
          <span className="text-[11px] font-bold text-mm-txw line-through decoration-r">
            {fmt(listPrice)}
          </span>
        </div>
      )}
      <div className="flex items-baseline gap-1">
        <p className={cn("text-sm font-bold", hasDiscount ? "text-r" : "text-mm-g")}>
          {fmt(price)}
        </p>
        <span className="text-[10px] text-mm-txw">/ {unit}</span>
      </div>
      {hasDiscount && savings > 0 && (
        <p className="mt-0.5 text-[10px] font-bold text-ok">{LINE_SAVINGS_LABEL(fmt(savings))}</p>
      )}
    </div>
  );
}
