'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react';

import { Button, Input, StepBar } from '@/src/components/Shared';
import { useAuthHooks } from '../hooks/useAuth';

export function ForgotPasswordModal({
  isOpen,
  onClose,
  onBackToLogin,
}: {
  isOpen: boolean;
  onClose: () => void;
  onBackToLogin?: () => void;
}) {
  const { forgotPassword, verifyResetCode, resetPassword, loading, error } = useAuthHooks();

  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const value = formData.get('email') as string;

    try {
      await forgotPassword(value);
      setEmail(value);
      setStep(1);
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const code = formData.get('code') as string;

    try {
      const { reset_token } = await verifyResetCode(email, code);
      setResetToken(reset_token);
      setStep(2);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const newPassword = formData.get('new_password') as string;
    const confirmPassword = formData.get('confirm_password') as string;

    if (newPassword !== confirmPassword) return;

    try {
      await resetPassword(email, resetToken, newPassword);
      setStep(3);
    } catch (err) {
      console.error(err);
    }
  };

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
        className="relative w-full max-w-md overflow-hidden rounded-[32px] bg-white shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute right-6 top-6 z-10 rounded-full p-2 transition-colors hover:bg-mm-gbg"
        >
          <X className="h-6 w-6 text-mm-txs" />
        </button>

        <div className="p-8 md:p-10">
          {step < 3 && <StepBar step={step} total={3} />}

          {error && (
            <div className="mb-5 rounded-2xl bg-red-100 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="mb-8 text-center">
                  <h2 className="mb-2 font-fraunces text-3xl text-mm-g">Recupera tu contraseña</h2>
                  <p className="text-mm-txs">Te enviaremos un código de 6 dígitos a tu correo.</p>
                </div>

                <form onSubmit={handleRequestCode} className="space-y-5">
                  <Input label="Correo electrónico" name="email" type="email" placeholder="ejemplo@correo.com" required />

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
                  <h2 className="mb-2 font-fraunces text-3xl text-mm-g">Revisa tu correo</h2>
                  <p className="text-mm-txs">
                    Si <span className="font-medium text-mm-g">{email}</span> está registrado, te enviamos un código. Ingrésalo aquí (vence en 10 minutos).
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
                    Verificar código
                    <ArrowRight className="h-5 w-5" />
                  </Button>

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
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="mb-8 text-center">
                  <h2 className="mb-2 font-fraunces text-3xl text-mm-g">Crea tu nueva contraseña</h2>
                  <p className="text-mm-txs">Elige una contraseña segura para tu cuenta.</p>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div className="relative">
                    <Input
                      label="Nueva contraseña"
                      name="new_password"
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

                  <Input label="Confirmar contraseña" name="confirm_password" type={showPass ? 'text' : 'password'} placeholder="••••••••" required />

                  <Button type="submit" className="w-full py-4 text-lg" loading={loading}>
                    Guardar contraseña
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </form>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-4 text-center">
                <CheckCircle2 className="mx-auto mb-6 h-16 w-16 text-mm-g" />
                <h2 className="mb-4 font-fraunces text-3xl text-mm-g">¡Contraseña actualizada!</h2>
                <p className="mb-10 text-mm-txs">Ya puedes iniciar sesión con tu nueva contraseña.</p>

                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    onClose();
                    onBackToLogin?.();
                  }}
                >
                  Ir a iniciar sesión
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
