'use client';

import { motion } from 'motion/react';
import { useApp } from '@/src/store';
import { Badge } from '@/src/components/Shared';
import { fmt } from '@/src/constants';
import { MapPin, Leaf, Flame, Trophy } from 'lucide-react';

export function DashboardTab() {
  const { state } = useApp();
  const profile = state.buyerProfile;

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
          <p className="text-mm-txs mb-4">Miembro desde {profile.memberSince}</p>
          <div className="flex flex-wrap justify-center md:justify-start gap-3">
            <Badge variant="oro" className="px-4 py-1.5 text-sm">
              ⭐ {profile.rating} Calificación
            </Badge>
            <Badge variant="info" className="px-4 py-1.5 text-sm">
              🪙 {profile.loyaltyPoints} PlazaCoins
            </Badge>
          </div>
        </div>
      </div>

      {/* Stats + Achievements */}
      <div className="grid sm:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[32px] border border-mm-crd shadow-sm">
          <h3 className="text-xl font-fraunces text-mm-g mb-6">Estadísticas</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] text-mm-txw font-bold uppercase tracking-widest mb-1">
                Pedidos
              </p>
              <p className="text-3xl font-bold text-mm-g">{profile.totalOrders}</p>
            </div>
            <div>
              <p className="text-[10px] text-mm-txw font-bold uppercase tracking-widest mb-1">
                Invertido
              </p>
              <p className="text-3xl font-bold text-mm-g">{fmt(profile.totalSpent)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[32px] border border-mm-crd shadow-sm">
          <h3 className="text-xl font-fraunces text-mm-g mb-6">Logros</h3>
          <div className="flex flex-wrap gap-3">
            {[
              { l: 'Primer pedido', icon: Leaf },
              { l: 'Cliente frecuente', icon: Flame },
              { l: 'Fan de la plaza', icon: MapPin },
              { l: 'Gourmet', icon: Trophy },
            ].map((logro) => (
              <div
                key={logro.l}
                className="w-12 h-12 bg-mm-gbg rounded-full flex items-center justify-center shadow-sm border border-white text-mm-g"
                title={logro.l}
              >
                <logro.icon className="w-6 h-6" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
