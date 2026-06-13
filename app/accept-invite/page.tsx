'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Mail, Lock, User, Phone } from 'lucide-react';
import { Button, Input } from '@/src/components/Shared';
import Image from 'next/image';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function AcceptInvite() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [hasInvite, setHasInvite] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const checkInvitation = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        
        // Wait for session recovery (which parses hash fragment `#access_token=...` and sets cookies)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error checking session:', sessionError);
        }

        // Fetch verification from GET api endpoint
        const res = await fetch('/api/auth/accept-invite');
        const result = await res.json();

        if (res.ok && result.authenticated) {
          setAuthenticated(true);
          setEmail(result.email);
          if (result.hasInvite) {
            setHasInvite(true);
            setStoreName(result.storeName);
          }
        }
      } catch (err) {
        console.error('Error checking invitation:', err);
      } finally {
        setChecking(false);
      }
    };

    checkInvitation();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !phone.trim() || !password || !confirmPassword) {
      setError('Por favor completa todos los campos.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          password
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Error al completar el registro.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#FAFAF5] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-mm-gll border-t-mm-g rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-mm-txs">Verificando invitación...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF5] flex flex-col items-center justify-center p-4 py-12 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-mm-gbg rounded-full blur-3xl opacity-60 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-mm-gbg rounded-full blur-3xl opacity-60 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white border border-mm-crd rounded-[32px] shadow-2xl p-8 relative z-10 flex flex-col items-center"
      >
        {/* System logo */}
        <Image
          src="/logo-mercamesa.png"
          alt="Mercamesa Logo"
          className="object-contain mb-8"
          width={148}
          height={48}
        />

        <AnimatePresence mode="wait">
          {!authenticated || !hasInvite ? (
            <motion.div
              key="invalid-invite"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center w-full"
            >
              <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-full flex items-center justify-center text-r mx-auto mb-4">
                <Mail className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-fraunces text-mm-g mb-3">Enlace Inválido o Expirado</h2>
              <p className="text-sm text-mm-txw leading-relaxed mb-6">
                Este enlace de invitación no es válido, ya ha sido utilizado o ha expirado.
                Por favor, solicita al administrador de tu plaza que te envíe una nueva invitación.
              </p>
              <Button onClick={() => router.push('/')} className="w-full">
                Ir al Inicio
              </Button>
            </motion.div>
          ) : success ? (
            <motion.div
              key="success-invite"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center w-full"
            >
              <div className="w-16 h-16 bg-[#D8F3DC] border border-[#1B4332]/20 rounded-full flex items-center justify-center text-[#1B4332] mx-auto mb-4 animate-pop-in">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-fraunces text-mm-g mb-3">¡Registro Completado! 🎉</h2>
              <p className="text-sm text-mm-txw leading-relaxed mb-8">
                Tu perfil de vendedor ha sido creado exitosamente y has sido asignado como miembro de la tienda{' '}
                <span className="font-bold text-mm-g">{storeName}</span>.
              </p>
              <Button onClick={() => router.push('/seller')} size="lg" className="w-full">
                Ir a mi panel →
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="form-invite"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full"
            >
              <div className="text-center mb-6">
                <h2 className="text-2xl font-fraunces text-mm-g mb-2">Completar Registro</h2>
                <p className="text-xs text-mm-txw">
                  Has sido invitado a formar parte de <span className="font-bold text-mm-g">{storeName}</span>.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-r rounded-xl text-xs font-semibold leading-relaxed">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Read Only */}
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="text-xs font-semibold text-mm-txw ml-1">Correo Electrónico</label>
                  <div className="px-4 py-2.5 rounded-xl border border-mm-crd bg-mm-gbg text-mm-txw text-sm select-none flex items-center gap-2">
                    <Mail className="w-4 h-4 text-mm-txw" />
                    <span>{email}</span>
                  </div>
                </div>

                <div className="relative">
                  <Input
                    label="Nombre Completo"
                    name="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej: Carlos Alberto Gómez"
                    required
                  />
                </div>

                <div className="relative">
                  <Input
                    label="Celular / Teléfono"
                    name="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej: 3001234567"
                    required
                  />
                </div>

                <div className="relative">
                  <Input
                    label="Contraseña"
                    type="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                  />
                </div>

                <div className="relative">
                  <Input
                    label="Confirmar Contraseña"
                    type="password"
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite tu contraseña"
                    required
                  />
                </div>

                <div className="pt-4">
                  <Button type="submit" loading={loading} className="w-full">
                    {loading ? 'Creando perfil...' : 'Confirmar y Unirme'}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
