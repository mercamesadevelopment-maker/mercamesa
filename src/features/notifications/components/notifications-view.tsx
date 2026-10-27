'use client';

import React from 'react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Bell, Check, CheckCircle2, CreditCard, ShoppingBag, Star, TrendingUp } from 'lucide-react';
import { useApp } from '@/src/store';
import { AppNotification } from '@/src/types';
import { Button } from '@/src/components/Shared';
import { cn } from '@/lib/utils/cn';
import { useNotifications } from '../hooks/use-notifications';

export function NotificationsView() {
  const { state } = useApp();
  const { markRead, markAllRead } = useNotifications();
  const router = useRouter();

  const handleNotifClick = (notif: AppNotification) => {
    markRead(notif.id);

    if (notif.entityType === 'store_offer' && notif.entityId) {
      if (notif.type === 'store_offer_pending') {
        router.push(`/admin/offers?offerId=${notif.entityId}`);
      } else if (notif.type === 'store_offer_reviewed') {
        router.push('/seller/sales/offers');
      }
    }
  };

  const getNotifIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'order_new': return { icon: ShoppingBag, color: 'bg-bluel text-blue' };
      case 'price_update': return { icon: TrendingUp, color: 'bg-mm-orl text-mm-oro' };
      case 'rating': return { icon: Star, color: 'bg-warnl text-warn' };
      case 'payment': return { icon: CreditCard, color: 'bg-okl text-ok' };
      case 'store_offer_pending': return { icon: AlertCircle, color: 'bg-mm-orl text-mm-oro' };
      case 'store_offer_reviewed': return { icon: CheckCircle2, color: 'bg-okl text-ok' };
      default: return { icon: Bell, color: 'bg-mm-gbg text-mm-g' };
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-display text-mm-g mb-2">Notificaciones</h1>
          <p className="text-mm-txs">Mantente al día con lo que pasa en tu cuenta.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => markAllRead()}>
          <Check className="w-4 h-4" /> Marcar todo como leído
        </Button>
      </div>

      <div className="space-y-4">
        {state.notifs.length === 0 ? (
          <div className="bg-white p-12 rounded-[32px] border border-mm-crd text-center opacity-40">
            <div className="text-7xl mb-4">🔔</div>
            <p className="text-xl font-display">No tienes notificaciones</p>
          </div>
        ) : (
          state.notifs.map(notif => {
            const { icon: Icon, color } = getNotifIcon(notif.type);
            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => handleNotifClick(notif)}
                className={cn(
                  "bg-white p-6 rounded-3xl border border-mm-crd shadow-sm flex gap-6 cursor-pointer transition-all hover:shadow-md relative overflow-hidden",
                  !notif.read && "border-l-4 border-l-mm-g bg-mm-gbg/20"
                )}
              >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0", color)}>
                  <Icon className="w-7 h-7" />
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-mm-g">{notif.title}</h4>
                    <span className="text-[10px] text-mm-txw font-bold uppercase">{notif.time}</span>
                  </div>
                  <p className="text-sm text-mm-txs leading-relaxed">{notif.msg}</p>
                </div>
                {!notif.read && (
                  <div className="absolute top-4 right-4 w-2 h-2 bg-mm-g rounded-full" />
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
