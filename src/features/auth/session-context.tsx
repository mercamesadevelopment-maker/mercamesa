'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, ReactNode } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { resolveRoleKey, type RoleKey } from '@/lib/auth/roles';
import type { BuyerProfile } from '@/src/features/auth/types/session.types';

interface SessionState {
  profile: BuyerProfile;
  role: RoleKey;
  isLoggedIn: boolean;
  /** Ya se preguntó a Supabase si hay sesión. Antes de eso, `isLoggedIn` no dice nada. */
  hydrated: boolean;
}

type SessionAction =
  | { type: 'SIGN_IN'; role: RoleKey; profile: Partial<BuyerProfile> }
  | { type: 'SIGN_OUT' }
  | { type: 'UPDATE_PROFILE'; profile: Partial<BuyerProfile> };

const EMPTY_PROFILE: BuyerProfile = { id: '', name: '', email: '', avatar: '' };

const initialState: SessionState = { profile: EMPTY_PROFILE, role: 'retail', isLoggedIn: false, hydrated: false };

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'SIGN_IN':
      return {
        profile: { ...state.profile, ...action.profile },
        role: action.role,
        isLoggedIn: true,
        hydrated: true,
      };
    case 'SIGN_OUT':
      return { ...initialState, hydrated: true };
    case 'UPDATE_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.profile } };
    default:
      return state;
  }
}

interface SessionContextValue extends SessionState {
  signIn: (role: RoleKey, profile: Partial<BuyerProfile>) => void;
  signOut: () => void;
  updateProfile: (profile: Partial<BuyerProfile>) => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

/** Quién tiene la sesión y con qué rol. Se rehidrata desde Supabase al montar y al cambiar la sesión. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, initialState);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const hydrate = async () => {
      try {
        // getUser() verifica la sesión contra el servidor (no solo la cookie)
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          dispatch({ type: 'SIGN_OUT' });
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, role_id, buyer_type, roles(name)')
          .eq('id', user.id)
          .single();
        if (!profile) {
          dispatch({ type: 'SIGN_OUT' });
          return;
        }

        dispatch({
          type: 'SIGN_IN',
          role: resolveRoleKey((profile.roles as any)?.name, profile.buyer_type),
          profile: {
            id: user.id,
            email: user.email || '',
            name: profile.full_name || '',
            avatar: profile.avatar_url || '',
            role_id: profile.role_id,
          },
        });
      } catch (err) {
        console.error('Hydration error:', err);
        dispatch({ type: 'SIGN_OUT' });
      }
    };

    hydrate();

    // Login/logout desde otra pestaña, renovación del token, etc.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') dispatch({ type: 'SIGN_OUT' });
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') hydrate();
    });

    // Volver con «atrás» desde el caché del navegador mostraría una sesión vieja.
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  const signIn = useCallback(
    (role: RoleKey, profile: Partial<BuyerProfile>) => dispatch({ type: 'SIGN_IN', role, profile }),
    []
  );
  const signOut = useCallback(() => dispatch({ type: 'SIGN_OUT' }), []);
  const updateProfile = useCallback(
    (profile: Partial<BuyerProfile>) => dispatch({ type: 'UPDATE_PROFILE', profile }),
    []
  );

  const value = useMemo(
    () => ({ ...state, signIn, signOut, updateProfile }),
    [state, signIn, signOut, updateProfile]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used within SessionProvider');
  return context;
}
