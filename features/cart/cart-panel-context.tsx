'use client';

import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Si el panel de la canasta está abierto. Lo abren el botón de la barra de arriba
 * y «Comprar ahora» de la página del producto; lo pinta `app-shell`.
 */
interface CartPanelValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const CartPanelContext = createContext<CartPanelValue | undefined>(undefined);

export function CartPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const value = useMemo(() => ({ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }), [isOpen]);
  return <CartPanelContext.Provider value={value}>{children}</CartPanelContext.Provider>;
}

export function useCartPanel(): CartPanelValue {
  const context = useContext(CartPanelContext);
  if (!context) throw new Error('useCartPanel must be used within CartPanelProvider');
  return context;
}
