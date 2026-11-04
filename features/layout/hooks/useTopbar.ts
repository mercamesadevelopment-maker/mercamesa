'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/features/auth/session-context';
import { useCartState } from '@/features/cart/cart-context';
import { useNotificationsState } from '@/features/notifications/notifications-context';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function useTopbar() {
  const session = useSession();
  const cartState = useCartState();
  const { notifs } = useNotificationsState();
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const cartCount = cartState.items.reduce((acc, item) => acc + item.qty, 0);
  const unreadNotifs = notifs.filter((n) => !n.read).length;

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/');
    setShowProfileMenu(false);
  };

  const toggleProfileMenu = () => setShowProfileMenu((prev) => !prev);
  const closeProfileMenu = () => setShowProfileMenu(false);

  return {
    session,
    router,
    showProfileMenu,
    toggleProfileMenu,
    closeProfileMenu,
    cartCount,
    unreadNotifs,
    handleLogout,
  };
}
