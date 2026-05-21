'use client';

import { motion } from 'motion/react';
import { useApp } from '@/src/store';
import { cn } from '@/src/components/Shared';

const PREFS = [
  {
    id: 'orderNotif',
    label: 'Estado de pedidos',
    sub: 'Recibir avisos cuando tu pedido cambie de estado.',
  },
  {
    id: 'promoNotif',
    label: 'Promociones y ofertas',
    sub: 'Enterarte de descuentos exclusivos en tus plazas favoritas.',
  },
  {
    id: 'stockNotif',
    label: 'Disponibilidad de stock',
    sub: 'Aviso cuando vuelvan productos de tus favoritos.',
  },
  {
    id: 'whatsappNotif',
    label: 'Alertas por WhatsApp',
    sub: 'Recibir resumen de tus pedidos directamente en tu móvil.',
  },
] as const;

export function PreferencesTab() {
  const { state, dispatch } = useApp();
  const profile = state.buyerProfile;

  const toggle = (key: keyof typeof profile.prefs) => {
    dispatch({
      type: 'UPDATE_BUYER_PROFILE',
      profile: { prefs: { ...profile.prefs, [key]: !profile.prefs[key] } },
    });
  };

  return (
    <motion.div
      key="prefs"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-white p-8 rounded-[40px] border border-mm-crd shadow-sm"
    >
      <h2 className="text-3xl font-fraunces text-mm-g mb-8">Notificaciones</h2>
      <div className="space-y-6 max-w-xl">
        {PREFS.map((pref) => (
          <div
            key={pref.id}
            className="flex items-center justify-between gap-6 p-4 rounded-3xl hover:bg-mm-gbg/50 transition-colors"
          >
            <div>
              <p className="font-bold text-mm-g">{pref.label}</p>
              <p className="text-xs text-mm-txw">{pref.sub}</p>
            </div>
            <button
              onClick={() => toggle(pref.id)}
              className={cn(
                'w-12 h-6 rounded-full relative transition-all duration-300',
                profile.prefs[pref.id] ? 'bg-mm-g' : 'bg-mm-crd'
              )}
            >
              <div
                className={cn(
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300',
                  profile.prefs[pref.id] ? 'left-7' : 'left-1'
                )}
              />
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
