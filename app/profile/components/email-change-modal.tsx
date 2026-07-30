'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react';

import { Button, Input, StepBar } from '@/src/components/Shared';
import { useEmailChange } from '../hooks/use-email-change';

export function EmailChangeModal({
  isOpen,
  onClose,
  currentEmail,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentEmail: string;
}) {
  const { loading, error, cooldownSeconds, requestChange, verifyChange } = useEmailChange();

  const [step, setStep] = useState(0);
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState('');

  const handleClose = () => {
    setStep(0);
    setNewEmail('');
    setPassword('');
    onClose();
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const email = (formData.get('new_email') as string).trim().toLowerCase();
    const currentPassword = formData.get('current_password') as string;

    const ok = await requestChange(email, currentPassword);
    if (ok) {
      setNewEmail(email);
      setPassword('');
      setStep(1);
    }
  };

  const handleResend = async () => {
    if (cooldownSeconds > 0 || !password) return;
    await requestChange(newEmail, password);
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const code = formData.get('code') as string;

    const email = await verifyChange(code);
    if (email) {
      setConfirmedEmail(email);
      setStep(2);
    }
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
          {step < 2 && <StepBar step={step} total={2} />}

          {error && (
            <div className="mb-5 rounded-2xl bg-red-100 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="mb-8 text-center">
                  <h2 className="mb-2 font-fraunces text-3xl text-mm-g">Cambiar correo</h2>
                  <p className="text-mm-txs">
                    Correo actual: <span className="font-medium text-mm-g">{currentEmail}</span>. Te enviaremos un código de 6 dígitos al correo nuevo.
                  </p>
                </div>

                <form onSubmit={handleRequestCode} className="space-y-5">
                  <Input label="Nuevo correo electrónico" name="new_email" type="email" placeholder="nuevo@correo.com" required />

                  <div className="relative">
                    <Input
                      label="Contraseña actual"
                      name="current_password"
                      type={showPass ? 'text' : 'password'}
                      placeholder="••••••••"
                      required
                      onChange={(e) => setPassword(e.target.value)}
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
                    Enviar código
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </form>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="mb-8 text-center">
                  <h2 className="mb-2 font-fraunces text-3xl text-mm-g">Revisa tu correo nuevo</h2>
                  <p className="text-mm-txs">
                    Enviamos un código a <span className="font-medium text-mm-g">{newEmail}</span>. Ingrésalo aquí (vence en 10 minutos).
                  </p>
                </div>

                <form onSubmit={handleVerifyCode} className="space-y-5">
                  <Input
                    label="Código de 6 dígitos"
                    name="code"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    required
                    className="text-center text-2xl tracking-[0.5em]"
                  />

                  <Button type="submit" className="w-full py-4 text-lg" loading={loading}>
                    Confirmar correo
                    <ArrowRight className="h-5 w-5" />
                  </Button>

                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={cooldownSeconds > 0 || loading}
                    className="w-full text-center text-sm text-mm-txs hover:underline disabled:opacity-50 disabled:hover:no-underline"
                  >
                    {cooldownSeconds > 0 ? `Reenviar en ${cooldownSeconds}s` : 'Reenviar código'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="w-full text-center text-sm text-mm-txs hover:underline"
                  >
                    Usar otro correo
                  </button>
                </form>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-4 text-center">
                <CheckCircle2 className="mx-auto mb-6 h-16 w-16 text-mm-g" />
                <h2 className="mb-4 font-fraunces text-3xl text-mm-g">¡Correo actualizado!</h2>
                <p className="mb-10 text-mm-txs">
                  Tu correo ahora es <span className="font-medium text-mm-g">{confirmedEmail}</span>.
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
