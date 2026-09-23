"use client";

import { Tag } from "lucide-react";
import { fmt } from "@/src/constants";
import {
  DISCOUNT_NOTICE_TITLE,
  DISCOUNT_NOTICE_BODY,
  DISCOUNT_NOTICE_TOTAL_LABEL,
} from "@/lib/copy/discount-notice";
import { CartItem } from "@/src/types";

interface DiscountSummaryProps {
  items: CartItem[];
  /** El precio que se está cobrando por unidad, ya con la oferta aplicada. */
  getPrice: (item: CartItem) => number;
  /**
   * El ahorro según el servidor. Es el que manda: `null` mientras se cotiza, y
   * lo que se muestra como total. Las líneas de abajo son el desglose.
   */
  discountTotal: number;
}

/**
 * Qué se está ahorrando el comprador, producto por producto, antes de pagar.
 *
 * Va en verde y no en ámbar a propósito: justo debajo hay dos avisos ámbar y uno
 * gris, y este no advierte de nada — es la única buena noticia del paso.
 *
 * El total sale del servidor (`quote.discountTotal`) y no de sumar las líneas:
 * es el mismo número con el que se calcula lo que se cobra, así que no puede
 * discrepar de lo que el comprador termina pagando. Que es justamente lo que
 * promete el texto.
 */
export function DiscountSummary({ items, getPrice, discountTotal }: DiscountSummaryProps) {
  const conDescuento = items
    .map((item) => {
      const precio = getPrice(item);
      const lista = item.listPrice ?? 0;
      return { item, precio, lista, ahorro: (lista - precio) * item.qty };
    })
    .filter((l) => l.ahorro > 0);

  if (discountTotal <= 0 || conDescuento.length === 0) return null;

  return (
    <div className="rounded-2xl border border-mm-g/25 bg-mm-gbg/50 p-4">
      <div className="flex items-start gap-2.5">
        <Tag className="mt-0.5 h-4 w-4 shrink-0 text-mm-g" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-mm-g">{DISCOUNT_NOTICE_TITLE}</p>
          <p className="text-xs leading-relaxed text-mm-txs">{DISCOUNT_NOTICE_BODY}</p>
        </div>
      </div>

      <ul className="mt-4 space-y-2.5">
        {conDescuento.map(({ item, precio, lista, ahorro }) => (
          <li key={item.id} className="flex items-start justify-between gap-3 text-xs">
            <div className="min-w-0">
              <p className="truncate font-bold text-mm-g">{item.name}</p>
              <p className="text-mm-txw">
                <span className="font-bold line-through decoration-r">{fmt(lista)}</span>{" "}
                <span className="font-bold text-mm-g">{fmt(precio)}</span>
                {item.qty > 1 && <span> × {item.qty}</span>}
              </p>
            </div>
            <span className="shrink-0 font-bold text-mm-g">Ahorras {fmt(ahorro)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-mm-g/20 pt-3">
        <span className="text-sm font-bold text-mm-g">{DISCOUNT_NOTICE_TOTAL_LABEL}</span>
        <span className="text-lg font-bold text-mm-g">{fmt(discountTotal)}</span>
      </div>
    </div>
  );
}
