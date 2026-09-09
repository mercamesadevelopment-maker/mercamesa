'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react';

import { Button, Input } from '@/src/components/Shared';
import { usePasswordChange, MIN_PASSWORD_LENGTH } from '../hooks/use-password-change';

export function PasswordChangeModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { loading, error, changePassword, reset } = usePasswordChange();

  const [done, setDone] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleClose = () => {
    setDone(false);
    setShowPass(false);
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);

    const ok = await changePassword(
      formData.get('current_password') as string,
      formData.get('new_password') as string,
      formData.get('confirm_password') as string
    );

    if (ok) setDone(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md overflow-hidden rounded-[32px] bg-white shadow-2xl"
      >
        <button
          onClick={handleClose}
          className="absolute right-6 top-6 z-10 rounded-full p-2 transition-colors hover:bg-mm-gbg"
        >
          <X className="h-6 w-6 text-mm-txs" />
        </button>

        <div className="p-8 md:p-10">
          {error && (
            <div className="mb-5 rounded-2xl bg-red-100 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {!done ? (
              <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="mb-8 text-center">
                  <h2 className="mb-2 font-fraunces text-3xl text-mm-g">Cambiar contraseña</h2>
                  <p className="text-mm-txs">
                    Confirma tu contraseña actual y elige una nueva de al menos {MIN_PASSWORD_LENGTH} caracteres.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="relative">
                    <Input
                      label="Contraseña actual"
                      name="current_password"
                      type={showPass ? 'text' : 'password'}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-4 top-10 text-mm-txw transition-colors hover:text-mm-g"
                    >
                      {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>

                  <Input
                    label="Nueva contraseña"
                    name="new_password"
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                  />

                  <Input
                    label="Confirmar nueva contraseña"
                    name="confirm_password"
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                  />

                  <Button type="submit" className="w-full py-4 text-lg" loading={loading}>
                    Guardar contraseña
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </form>
              </motion.div>
            ) : (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-4 text-center">
                <CheckCircle2 className="mx-auto mb-6 h-16 w-16 text-mm-g" />
                <h2 className="mb-4 font-fraunces text-3xl text-mm-g">¡Contraseña actualizada!</h2>
                <p className="mb-10 text-mm-txs">
                  Te enviamos un aviso a tu correo. La próxima vez que ingreses, usa tu contraseña nueva.
                </p>

                <Button size="lg" className="w-full" onClick={handleClose}>
                  Listo
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
