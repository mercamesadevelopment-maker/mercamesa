'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatQuantity } from '@/lib/utils/format';
import type { LogisticsPart } from '@/lib/logistics/orders';

/** Cuántos productos se ven antes de «Ver todos». */
const PRODUCTOS_VISIBLES = 4;

/** Lo que trae la parte, sin precios: es lo que logística revisa al recibir. */
export function PartItems({ part }: { part: LogisticsPart }) {
  const [todos, setTodos] = useState(false);
  if (part.items.length === 0) return null;

  const visibles = todos ? part.items : part.items.slice(0, PRODUCTOS_VISIBLES);

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-widest text-mm-txw mb-1">
        {part.items.length === 1 ? '1 producto' : `${part.items.length} productos`}
      </p>
      <ul className="space-y-0.5 text-sm text-mm-g">
        {visibles.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-mono font-bold shrink-0">
              {formatQuantity(item.quantity)} {item.unit}
            </span>
            <span className="text-mm-txs">{item.name}</span>
          </li>
        ))}
      </ul>
      {part.items.length > PRODUCTOS_VISIBLES && (
        <button
          type="button"
          onClick={() => setTodos((t) => !t)}
          className="mt-1 flex items-center gap-1 text-xs font-bold text-mm-g underline"
        >
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', todos && 'rotate-180')} />
          {todos ? 'Ver menos' : `Ver los ${part.items.length}`}
        </button>
      )}
    </div>
  );
}
