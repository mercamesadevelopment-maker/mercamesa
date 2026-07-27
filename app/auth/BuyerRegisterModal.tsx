'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { X, Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react';

import { useApp } from '@/src/store';
import { Button, Input, cn } from '@/src/components/Shared';
import { useAuthHooks } from '../hooks/useAuth';

const TERMS_VERSION = '2026-07-24';

const DOCUMENT_TYPES = [
  { value: 'cedula', label: 'Cédula de ciudadanía' },
  { value: 'nit', label: 'NIT' },
  { value: 'cedula_extranjeria', label: 'Cédula de extranjería' },
  { value: 'pasaporte', label: 'Pasaporte' },
];

type PersonType = 'natural' | 'juridica';
type BuyerType = 'retail' | 'wholesale';

function Select({
  label,
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && <label className="ml-1 text-sm font-medium text-mm-txs">{label}</label>}
      <select
        className={cn(
          'rounded-xl border-1.5 border-mm-crd bg-white px-4 py-2.5 outline-none transition-all focus:border-mm-g focus:ring-2 focus:ring-mm-gll',
          className
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

export function BuyerRegisterModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { dispatch } = useApp();
  const router = useRouter();
  const { registerBuyer, loading, error } = useAuthHooks();

  const [success, setSuccess] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [personType, setPersonType] = useState<PersonType>('natural');
  const [buyerType, setBuyerType] = useState<BuyerType>('retail');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirm_password') as string;

    if (password !== confirmPassword) {
      return;
    }

    try {
      await registerBuyer({
        email: formData.get('email') as string,
        password,
        person_type: personType,
        document_type: formData.get('document_type') as string,
        document_number: formData.get('document_number') as string,
        full_name: personType === 'natural' ? (formData.get('full_name') as string) : undefined,
        business_name: personType === 'juridica' ? (formData.get('business_name') as string) : undefined,
        contact_name: personType === 'juridica' ? (formData.get('contact_name') as string) : undefined,
        phone: formData.get('phone') as string,
        buyer_type: buyerType,
        terms_version: TERMS_VERSION,
      });

      setSuccess(true);
    } catch (err) {
      // El error ya se maneja en el hook
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
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute right-6 top-6 z-10 rounded-full p-2 transition-colors hover:bg-mm-gbg"
        >
          <X className="h-6 w-6 text-mm-txs" />
        </button>

        <div className="overflow-y-auto p-8 md:p-10">
          {success ? (
            <div className="py-8 text-center">
              <div className="mb-6 inline-block animate-pop-in text-8xl">🛒</div>

              <h2 className="mb-4 font-fraunces text-4xl text-mm-g">¡Listo, bienvenido! 🎉</h2>

              <p className="mx-auto mb-10 max-w-md text-mm-txs">
                Tu cuenta de comprador ha sido creada con éxito. Ya puedes empezar a comprar en MercaMesa.
              </p>

              <Button
                size="lg"
                className="mx-auto w-full max-w-xs"
                onClick={() => {
                  dispatch({ type: 'LOGIN', role: buyerType });
                  onClose();
                  router.push('/marketplaces');
                }}
              >
                Entrar a mi cuenta
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-8 text-center">
                <h2 className="mb-2 font-fraunces text-3xl text-mm-g">Crea tu cuenta de comprador</h2>
                <p className="text-mm-txs">Regístrate para comprar en MercaMesa.</p>
              </div>

              {error && (
                <div className="mb-5 rounded-2xl bg-red-100 p-4 text-sm text-red-600">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
                <Select label="Tipo de persona" value={personType} onChange={(e) => setPersonType(e.target.value as PersonType)}>
                  <option value="natural">Natural</option>
                  <option value="juridica">Jurídica</option>
                </Select>

                <Select label="¿Compras al detal o al por mayor?" value={buyerType} onChange={(e) => setBuyerType(e.target.value as BuyerType)}>
                  <option value="retail">Al detal (minorista)</option>
                  <option value="wholesale">Al por mayor (mayorista)</option>
                </Select>

                <Select label="Tipo de identificación" name="document_type" defaultValue="" required>
                  <option value="" disabled>Selecciona...</option>
                  {DOCUMENT_TYPES.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </Select>

                <Input label="Número de identificación" name="document_number" placeholder="1234567890" required />

                {personType === 'natural' && (
                  <Input label="Nombre completo" name="full_name" placeholder="Juan Pérez" required className="sm:col-span-2" />
                )}

                {personType === 'juridica' && (
                  <>
                    <Input label="Razón social" name="business_name" placeholder="Restaurante El Sabor S.A.S." required />
                    <Input label="Nombre del contacto principal" name="contact_name" placeholder="Juan Pérez" required />
                  </>
                )}

                <Input label="Correo electrónico" name="email" type="email" placeholder="juan@correo.com" required className="sm:col-span-2" />

                <Input label="Teléfono celular" name="phone" type="tel" placeholder="+57 300 000 0000" required />

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
                    {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                <Input label="Confirmar contraseña" name="confirm_password" type={showPass ? 'text' : 'password'} placeholder="••••••••" required />

                <div className="mt-2 flex items-center gap-2 text-xs text-mm-txs sm:col-span-2">
                  <input type="checkbox" required className="rounded border-mm-crd text-mm-g focus:ring-mm-g" />
                  Acepto los términos y condiciones y la política de privacidad.
                </div>

                <Button type="submit" className="mt-4 w-full sm:col-span-2" loading={loading}>
                  Crear cuenta
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
