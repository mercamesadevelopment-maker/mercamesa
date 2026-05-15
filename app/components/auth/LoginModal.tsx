'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { X, Eye, EyeOff, ArrowRight } from 'lucide-react';

import { useApp } from '@/src/store';
import { Button, Input } from '@/src/components/Shared';
import { useAuthHooks } from '../../hooks/useAuth';

export function LoginModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { dispatch } = useApp();
  const router = useRouter();

  const { login, loading, error } = useAuthHooks();

  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget as HTMLFormElement);

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const user = await login(email, password);

      // Si tu hook ya maneja el estado global,
      // puedes eliminar este dispatch
      if (user) {
        dispatch({
          type: 'LOGIN',
          role: user.role || user.role_id || 'retail',
          profile: user.profile || user,
        });
      }

      onClose();

      const role = user?.role || user?.role_id;

      if (role === 'admin') {
        router.push('/admin/marketplaces');
      } else if (role === 'provider') {
        router.push('/seller/dashboard');
      } else if (role === 'delivery') {
        router.push('/delivery');
      } else {
        router.push('/marketplaces');
      }
    } catch (err) {
      // El error ya se maneja en el hook
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md overflow-hidden rounded-[32px] bg-white shadow-2xl"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-6 top-6 rounded-full p-2 transition-colors hover:bg-mm-gbg"
        >
          <X className="h-6 w-6 text-mm-txs" />
        </button>

        {/* Content */}
        <div className="p-8 md:p-10">
          {/* Logo */}
          <div className="mb-10 flex items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mm-oro text-2xl">
              🌿
            </div>

            <div>
              <h1 className="font-fraunces text-2xl font-bold text-mm-g">
                Mercamesa
              </h1>

              <p className="text-sm text-mm-txs">
                Plataforma agroalimentaria
              </p>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8 text-center">
            <h2 className="mb-2 font-fraunces text-3xl text-mm-g">
              Bienvenido de vuelta
            </h2>

            <p className="text-mm-txs">
              Ingresa tus credenciales para continuar.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 rounded-2xl bg-red-100 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <Input
              label="Correo electrónico"
              name="email"
              type="email"
              placeholder="ejemplo@correo.com"
              required
            />

            <div className="relative">
              <Input
                label="Contraseña"
                name="password"
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                required
              />

              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-10 text-mm-txw transition-colors hover:text-mm-g"
              >
                {showPass ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>

            <Button
              type="submit"
              className="w-full py-4 text-lg"
              loading={loading}
            >
              Ingresar
              <ArrowRight className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}