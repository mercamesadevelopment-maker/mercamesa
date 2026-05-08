import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { X, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useApp } from '@/src/store';
import { ROLES } from '@/src/constants';
import { RoleKey } from '@/src/types';
import { Button, Input, cn } from '@/src/components/Shared';
import { useAuthHooks } from '../../hooks/useAuth';

const roleHome: Record<string, string> = {
  retail: '/marketplaces', wholesale: '/marketplaces',
  provider: '/seller/dashboard', delivery: '/delivery', admin: '/admin/marketplaces',
};

export function LoginModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { dispatch } = useApp();
  const router = useRouter();
  const { login, loading, error } = useAuthHooks();
  const [role, setRole] = useState<RoleKey>('retail');
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    // Fast-path demo login
    if (email === 'info@pq-scem.com' && password === 'admin') {
      let profile = { name: 'Super Administrador' as string, email, avatar: '👔' as string, role_id: undefined as string | undefined };
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (res.ok) {
          const data = await res.json();
          const p = data.profile;
          if (p) {
            profile = { name: p.full_name || 'Super Administrador', email, avatar: p.avatar_url || '👔', role_id: p.role_id };
          }
        }
      } catch {}
      dispatch({ type: 'LOGIN', role: 'admin', profile });
      onClose();
      router.push('/admin/marketplaces');
      return;
    }

    try {
      await login(email, password, role);
      onClose();
      router.push(roleHome[role] || '/marketplaces');
    } catch (err) {
      // Error is handled in hook
    }
  };

  const demoAccounts = [
    { r: 'retail', e: 'maria@gmail.com', p: '123456' },
    { r: 'wholesale', e: 'chef@restaurante.com', p: '123456' },
    { r: 'provider', e: 'don.carlos@plaza.com', p: '123456' },
    { r: 'delivery', e: 'juan@reparto.com', p: '123456' },
    { r: 'admin', e: 'info@pq-scem.com', p: 'admin', label: 'Super Admin' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col md:flex-row max-w-4xl w-full max-h-[90vh]"
      >
        <div className="w-full md:w-72 bg-[#1C2B0E] p-8 text-white flex flex-col">
          <div className="flex items-center gap-2 mb-12">
            <div className="w-8 h-8 bg-mm-oro rounded-lg flex items-center justify-center text-xl">🌿</div>
            <span className="text-xl font-bold font-fraunces">Mercamesa</span>
          </div>
          
          <p className="text-xs text-mm-txw mb-6 uppercase tracking-widest font-bold">Selecciona tu rol</p>
          <div className="space-y-3 flex-grow">
            {ROLES.map(r => (
              <button
                key={r.k}
                onClick={() => setRole(r.k)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left group",
                  role === r.k ? "bg-white/10 border border-white/20" : "hover:bg-white/5"
                )}
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">{r.emoji}</span>
                <div>
                  <p className={cn("text-sm font-bold", role === r.k ? "text-white" : "text-mm-txw")}>{r.title}</p>
                  <p className="text-[10px] text-mm-txw/60">{r.tagline}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-grow p-8 md:p-12 overflow-y-auto">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors">
            <X className="w-6 h-6 text-mm-txs" />
          </button>

          <div className="max-w-md mx-auto">
            <h2 className="text-3xl font-fraunces text-mm-g mb-2">Bienvenido de vuelta</h2>
            <p className="text-mm-txs mb-8">Ingresa tus credenciales para continuar.</p>

            {error && <div className="mb-4 p-3 bg-red-100 text-red-600 rounded-xl text-sm">{error}</div>}

            <form onSubmit={handleLogin} className="space-y-5">
              <Input label="Correo electrónico" name="email" type="email" placeholder="ejemplo@correo.com" required />
              <div className="relative">
                <Input 
                  label="Contraseña" 
                  name="password"
                  type={showPass ? "text" : "password"} 
                  placeholder="••••••••" 
                  required 
                />
                <button 
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-10 text-mm-txw hover:text-mm-g"
                >
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <Button type="submit" className="w-full py-4 text-lg" loading={loading}>
                Ingresar <ArrowRight className="w-5 h-5" />
              </Button>
            </form>

            <div className="mt-10">
              <p className="text-xs text-mm-txw uppercase tracking-widest font-bold mb-4 text-center">Cuentas demo rápidas</p>
              <div className="grid grid-cols-2 gap-3">
                {demoAccounts.map(acc => (
                  <button
                    key={acc.r}
                    onClick={async () => {
                      if (acc.e === 'info@pq-scem.com') {
                        let profile = { name: 'Super Administrador' as string, email: acc.e, avatar: '👔' as string, role_id: undefined as string | undefined };
                        try {
                          const res = await fetch('/api/auth/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: acc.e, password: 'admin' }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            const p = data.profile;
                            if (p) {
                              profile = { name: p.full_name || 'Super Administrador', email: acc.e, avatar: p.avatar_url || '👔', role_id: p.role_id };
                            }
                          }
                        } catch {}
                        dispatch({ type: 'LOGIN', role: 'admin', profile });
                      } else {
                        setRole(acc.r as RoleKey);
                        dispatch({ type: 'LOGIN', role: acc.r as RoleKey });
                      }
                      onClose();
                      router.push(roleHome[acc.r] || '/marketplaces');
                    }}
                    className="p-3 rounded-xl border border-mm-crd hover:border-mm-g hover:bg-mm-gbg transition-all text-left flex items-center gap-2"
                  >
                    <span className="text-xl">{ROLES.find(r => r.k === acc.r)?.emoji}</span>
                    <span className="text-xs font-medium text-mm-txs capitalize">
                      {acc.label || acc.r}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
