'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react';

import { Button, Input, StepBar } from '@/src/components/Shared';
import { usePasswordChange, MIN_PASSWORD_LENGTH } from '../hooks/use-password-change';

export function PasswordChangeModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { loading, error, cooldownSeconds, requestCode, changePassword, reset } =
    usePasswordChange();

  // 0 contraseña actual · 1 código · 2 contraseña nueva. La nueva se pide al
  // final a propósito: quien no tenga el código no llega siquiera a escribirla.
  const [paso, setPaso] = useState(0);
  const [claveActual, setClaveActual] = useState('');
  const [codigo, setCodigo] = useState('');
  const [done, setDone] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleClose = () => {
    setPaso(0);
    setClaveActual('');
    setCodigo('');
    setDone(false);
    setShowPass(false);
    reset();
    onClose();
  };

  const handleActual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await requestCode(claveActual)) setPaso(1);
  };

  const handleCodigo = (e: React.FormEvent) => {
    e.preventDefault();
    // El código se comprueba de verdad en el último paso, junto con el cambio:
    // gastarlo acá dejaría a la persona sin código si la contraseña nueva no
    // cumpliera la política.
    setPaso(2);
  };

  const handleNueva = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);

    const ok = await changePassword(
      codigo,
      formData.get('new_password') as string,
      formData.get('confirm_password') as string
    );

    // Si falla, el error queda a la vista y se puede corregir sin salir del
    // paso: un código equivocado se arregla volviendo con «Volver al código».
    if (ok) setDone(true);
  };

  const handleReenviar = async () => {
    if (cooldownSeconds > 0 || loading) return;
    await requestCode(claveActual);
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
            {done ? (
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
            ) : (
              <motion.div key={`paso-${paso}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="mb-8 text-center">
                  <h2 className="mb-2 font-fraunces text-3xl text-mm-g">Cambiar contraseña</h2>
                  <p className="text-mm-txs">
                    {paso === 0 && 'Primero confirma tu contraseña actual.'}
                    {paso === 1 && 'Te enviamos un código de 6 dígitos a tu correo.'}
                    {paso === 2 && `Elige una contraseña de al menos ${MIN_PASSWORD_LENGTH} caracteres.`}
                  </p>
                </div>

                <StepBar step={paso} total={3} />

                {paso === 0 && (
                  <form onSubmit={handleActual} className="space-y-5">
                    <div className="relative">
                      <Input
                        label="Contraseña actual"
                        name="current_password"
                        type={showPass ? 'text' : 'password'}
                        value={claveActual}
                        onChange={(e) => setClaveActual(e.target.value)}
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

                    <Button type="submit" className="w-full py-4 text-lg" loading={loading}>
                      Enviarme el código
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </form>
                )}

                {paso === 1 && (
                  <form onSubmit={handleCodigo} className="space-y-5">
                    <Input
                      label="Código de 6 dígitos"
                      name="code"
                      inputMode="numeric"
                      maxLength={6}
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="text-center text-2xl tracking-[0.5em]"
                      autoFocus
                      required
                    />

                    <Button
                      type="submit"
                      className="w-full py-4 text-lg"
                      disabled={codigo.length !== 6}
                    >
                      Continuar
                      <ArrowRight className="h-5 w-5" />
                    </Button>

                    <div className="flex items-center justify-between text-sm">
                      <button
                        type="button"
                        onClick={() => setPaso(0)}
                        className="font-medium text-mm-txs hover:underline"
                      >
                        Volver
                      </button>

                      <button
                        type="button"
                        onClick={handleReenviar}
                        disabled={cooldownSeconds > 0 || loading}
                        className="font-medium text-mm-g hover:underline disabled:cursor-not-allowed disabled:text-mm-txw disabled:no-underline"
                      >
                        {cooldownSeconds > 0 ? `Reenviar en ${cooldownSeconds}s` : 'Reenviar código'}
                      </button>
                    </div>
                  </form>
                )}

                {paso === 2 && (
                  <form onSubmit={handleNueva} className="space-y-5">
                    <Input
                      label="Nueva contraseña"
                      name="new_password"
                      type={showPass ? 'text' : 'password'}
                      placeholder="••••••••"
                      minLength={MIN_PASSWORD_LENGTH}
                      autoFocus
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

                    <button
                      type="button"
                      onClick={() => setPaso(1)}
                      className="w-full text-center text-sm font-medium text-mm-txs hover:underline"
                    >
                      Volver al código
                    </button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
