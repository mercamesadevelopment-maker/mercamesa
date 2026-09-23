'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { useApp } from '@/src/store';
import { fechaCorta } from '@/lib/dates/relative-time';
import { useBuyerStats } from '../hooks/use-buyer-stats';

/**
 * El tablero del comprador.
 *
 * Antes mostraba cinco cifras que salían todas de `DEFAULT_BUYER_PROFILE` y
 * ninguna de la base: 23 pedidos, $1.240.000 invertidos, 1.860 PlazaCoins, 4,9
 * de calificación y "miembro desde enero de 2024" — lo mismo para todo el mundo,
 * incluido quien se acababa de registrar.
 *
 * Ahora solo queda lo que se puede sostener con datos. Los PlazaCoins no existen
 * en ninguna parte del sistema, y la calificación del comprador
 * (`profiles.reputation_score`) es una columna que nadie escribe todavía.
 */
export function DashboardTab() {
  const { state } = useApp();
  const profile = state.buyerProfile;
  const { stats, loading } = useBuyerStats();

  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      {/* Profile header card */}
      <div className="bg-white p-8 rounded-[40px] border border-mm-crd shadow-sm flex flex-col md:flex-row gap-8 items-center">
        <div className="w-32 h-32 bg-mm-gll rounded-full flex items-center justify-center border-4 border-white shadow-xl overflow-hidden">
          {profile.avatar ? (
            <img
              src={profile.avatar}
              alt={profile.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-mm-g text-4xl font-bold">
              {profile.name?.charAt(0)}
            </div>
          )}
        </div>
        <div className="flex-grow text-center md:text-left">
          <h2 className="text-4xl font-fraunces text-mm-g mb-1">{profile.name}</h2>
          {stats?.memberSince && (
            <p className="text-mm-txs">Miembro desde {fechaCorta(stats.memberSince)}</p>
          )}
        </div>
      </div>

      {/* Estadísticas */}
      <div className="bg-white p-8 rounded-[32px] border border-mm-crd shadow-sm">
        <h3 className="text-xl font-fraunces text-mm-g mb-6">Tus pedidos</h3>
        <div className="grid grid-cols-2 gap-6">
          <Cifra etiqueta="Pedidos" valor={stats?.totalOrders} cargando={loading} />

          {/* "En curso" en vez de cuánto lleva gastado: es un número sobre el que
              se puede actuar, y lleva a donde está la respuesta. */}
          <Link href="/orders" className="group block">
            <Cifra
              etiqueta="En curso"
              valor={stats?.inProgress}
              cargando={loading}
              enlace
            />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Una cifra. Mientras carga muestra un guion y no un cero: un cero afirma que no
 * hay pedidos, y todavía no se sabe.
 */
function Cifra({
  etiqueta,
  valor,
  cargando,
  enlace,
}: {
  etiqueta: string;
  valor: number | undefined;
  cargando: boolean;
  enlace?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] text-mm-txw font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
        {etiqueta}
        {enlace && (
          <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </p>
      <p className="text-3xl font-bold text-mm-g">
        {cargando || valor === undefined ? (
          <span className="text-mm-txw">—</span>
        ) : (
          valor
        )}
      </p>
    </div>
  );
}
