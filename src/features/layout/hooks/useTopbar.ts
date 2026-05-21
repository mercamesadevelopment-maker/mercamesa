'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/src/store';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function useTopbar() {
  const { state } = useApp();
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const cartCount = state.cart.reduce((acc, item) => acc + item.qty, 0);
  const unreadNotifs = state.notifs.filter((n) => !n.read).length;

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/');
    setShowProfileMenu(false);
  };

  const toggleProfileMenu = () => setShowProfileMenu((prev) => !prev);
  const closeProfileMenu = () => setShowProfileMenu(false);

  return {
    state,
    router,
    showProfileMenu,
    toggleProfileMenu,
    closeProfileMenu,
    cartCount,
    unreadNotifs,
    handleLogout,
  };
}
