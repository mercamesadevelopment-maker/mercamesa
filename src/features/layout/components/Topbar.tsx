'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingCart,
  User,
  LogOut,
  LayoutDashboard,
  MessageSquare,
  ChevronDown,
  Leaf,
} from 'lucide-react';
import { cn } from '@/src/components/Shared';
import { useTopbar } from '../hooks/useTopbar';

interface TopbarProps {
  onCartOpen: () => void;
  onToggleSidebar: () => void;
}

export function Topbar({ onCartOpen, onToggleSidebar }: TopbarProps) {
  const {
    state,
    router,
    showProfileMenu,
    toggleProfileMenu,
    closeProfileMenu,
    cartCount,
    handleLogout,
  } = useTopbar();

  return (
    <header className="fixed top-0 left-0 w-full h-16 bg-mm-g text-white z-[60] flex items-center justify-between px-4 lg:px-8 shadow-lg">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-white/10 rounded-xl transition-colors shrink-0"
        >
          <LayoutDashboard className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-mm-oro rounded-lg flex items-center justify-center shadow-inner">
            <Leaf className="w-5 h-5 text-white" />
          </div>

          <span className="text-xl font-bold font-fraunces hidden sm:block">
            Mercamesa
          </span>
        </div>
      </div>

      <div className="flex-grow max-w-xl mx-8 hidden lg:block text-mm-gll font-medium text-sm tracking-wide">
        {state.userRole === 'admin'
          ? 'PANEL DE ADMINISTRACIÓN'
          : state.userRole === 'provider'
          ? 'GESTIÓN DE PROVEEDOR'
          : state.userRole === 'delivery'
          ? 'CENTRO DE REPARTO'
          : 'MARKETPLACE MERCAMESA'}
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <button
          onClick={onCartOpen}
          className="relative p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <ShoppingCart className="w-6 h-6" />

          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-mm-oro text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-mm-g animate-pop-in">
              {cartCount}
            </span>
          )}
        </button>

        <div className="relative">
          <button
            onClick={toggleProfileMenu}
            className="flex items-center gap-2 pl-2 border-l border-white/20 ml-2 hover:bg-white/10 p-1 rounded-xl transition-all"
          >
            {state.buyerProfile.avatar ? (
              <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20">
                <img
                  src={state.buyerProfile.avatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <User className="w-5 h-5 text-white" />
            )}

            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold leading-none">
                {state.buyerProfile.name}
              </p>

              <p className="text-[10px] text-mm-gll uppercase font-bold tracking-tighter">
                {state.userRole}
              </p>
            </div>

            <ChevronDown
              className={cn(
                'w-4 h-4 text-mm-gll transition-transform',
                showProfileMenu && 'rotate-180'
              )}
            />
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={closeProfileMenu}
                />

                <motion.div
                  initial={{
                    opacity: 0,
                    y: 10,
                    scale: 0.95,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    y: 10,
                    scale: 0.95,
                  }}
                  className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-mm-crd z-50 overflow-hidden py-2"
                >
                  <div className="px-4 py-3 border-b border-mm-crd mb-2">
                    <p className="text-xs text-mm-txw font-bold uppercase tracking-widest leading-none mb-1">
                      Tu Cuenta
                    </p>

                    <p className="text-sm font-bold text-mm-g truncate">
                      {state.buyerProfile.name}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      router.push('/profile');
                      closeProfileMenu();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-mm-txs hover:bg-mm-gbg hover:text-mm-g flex items-center gap-2 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Mi Perfil
                  </button>

                  <button
                    onClick={() => {
                      router.push('/support');
                      closeProfileMenu();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-mm-txs hover:bg-mm-gbg hover:text-mm-g flex items-center gap-2 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Ayuda y Soporte
                  </button>

                  <div className="h-px bg-mm-crd my-2" />

                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-r hover:bg-rl flex items-center gap-2 transition-colors font-bold"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
