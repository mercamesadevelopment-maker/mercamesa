'use client';

import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Product } from '@/features/products/types/product.types';

/** Cuántos productos muestra: siempre los mismos, haya 20 o 2.000. */
const TOP = 10;
const MAX_NOMBRE = 26;

const corto = (s: string) => (s.length > MAX_NOMBRE ? `${s.slice(0, MAX_NOMBRE - 1)}…` : s);

/**
 * «Los que se están acabando»: los 10 productos publicados con menos stock, en
 * barras horizontales con el nombre a la izquierda. Antes había una barra por
 * producto y con cientos no se leía nada.
 */
export function StockChart({ products }: { products: Product[] }) {
  const publicados = useMemo(() => products.filter((p) => p.status === 'active'), [products]);
  const datos = useMemo(
    () =>
      [...publicados]
        .sort((a, b) => a.stock - b.stock)
        .slice(0, TOP)
        .map((p) => ({ nombre: corto(p.name), completo: p.name, stock: p.stock, unidad: p.unit })),
    [publicados]
  );
  const agotados = publicados.filter((p) => p.stock <= 0).length;
  const sinMayorista = publicados.filter((p) => p.wholesalePrice == null).length;

  return (
    <div className="flex h-full flex-col rounded-[40px] border border-mm-crd bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-xl text-mm-g">
          Los que se están acabando <Activity className="h-5 w-5 text-mm-txw" />
        </h3>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-mm-txw">
            <span className="h-2.5 w-2.5 rounded-full bg-tinta" /> Con stock
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-mm-txw">
            <span className="h-2.5 w-2.5 rounded-full bg-arcilla" /> Agotado
          </span>
        </div>
      </div>

      <dl className="mb-4 grid grid-cols-3 gap-2">
        {[
          { label: 'Publicados', valor: publicados.length },
          { label: 'Agotados', valor: agotados },
          { label: 'Sin mayorista', valor: sinMayorista },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl bg-hueso px-3 py-2">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-mm-txw">{c.label}</dt>
            <dd className="font-display text-xl font-extrabold text-tinta">{c.valor}</dd>
          </div>
        ))}
      </dl>

      {datos.length === 0 ? (
        <p className="flex flex-grow items-center justify-center text-sm italic text-mm-txw">Sin productos publicados</p>
      ) : (
        // Alto fijo por barra: el espacio queda reservado aunque lleguen menos.
        <div style={{ height: datos.length * 30 + 10 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="nombre"
                width={170}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--color-tinta)' }}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-hueso)' }}
                formatter={(v: number, _n, item) => [`${v} ${item.payload.unidad}`, 'Stock']}
                labelFormatter={(_l, items) => items?.[0]?.payload?.completo ?? ''}
                contentStyle={{ borderRadius: 16, border: '1px solid var(--color-linea)' }}
              />
              <Bar dataKey="stock" radius={[0, 8, 8, 0]} barSize={16} minPointSize={3}>
                {datos.map((d, i) => (
                  <Cell key={i} fill={d.stock <= 0 ? 'var(--color-arcilla)' : 'var(--color-tinta)'} />
                ))}
                <LabelList
                  dataKey="stock"
                  position="right"
                  formatter={(v: number) => String(v)}
                  style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fill: 'var(--color-tinta)' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
