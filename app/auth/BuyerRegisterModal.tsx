'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { X, Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react';

import { useApp } from '@/src/store';
import { Button, Input, Select } from '@/src/components/Shared';
import { PhoneInput } from '@/components/ui/phone-input/PhoneInput';
import { useAuthHooks } from '../hooks/useAuth';
import { useIdentificationTypes } from '@/app/hooks/use-identification-types';

const TERMS_VERSION = '2026-07-24';

type BuyerType = 'retail' | 'wholesale';

export function BuyerRegisterModal({
  isOpen,
  onClose,
  onLoginClick,
}: {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Salida hacia el inicio de sesión cuando el correo ya tiene cuenta. Recibe el
   * correo escrito para no obligar a teclearlo otra vez. Sin este prop el aviso
   * se muestra igual, solo sin botón.
   */
  onLoginClick?: (email: string) => void;
}) {
  const { dispatch } = useApp();
  const router = useRouter();
  const { registerBuyer, loading, error, errorCode } = useAuthHooks();

  const { personTypes, loading: loadingTypes } = useIdentificationTypes();

  const [success, setSuccess] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [personTypeId, setPersonTypeId] = useState('');
  const [identificationTypeId, setIdentificationTypeId] = useState('');
  const [buyerType, setBuyerType] = useState<BuyerType>('retail');
  // El resto del formulario se lee con `FormData`, pero el teléfono necesita
  // estado: el selector de país y el campo son un solo valor en E.164.
  const [phone, setPhone] = useState('');
  // Se guarda al enviar para poder pasarlo al inicio de sesión si resulta que
  // ese correo ya tiene cuenta; el campo se lee con `FormData` y para entonces
  // ya no está a mano.
  const [submittedEmail, setSubmittedEmail] = useState('');

  // El primero de la lista queda preseleccionado, como antes lo estaba "Natural".
  useEffect(() => {
    if (!personTypeId && personTypes.length > 0) {
      setPersonTypeId(personTypes[0].id);
    }
  }, [personTypes, personTypeId]);

  const personType = personTypes.find((p) => p.id === personTypeId) ?? null;
  const identificationOptions = personType?.identification_types ?? [];

  // Al cambiar el tipo de persona, una identificación ya elegida puede dejar de
  // ser válida (Natural con NIT). Se limpia en vez de dejar la combinación mala.
  useEffect(() => {
    if (identificationTypeId && !identificationOptions.some((t) => t.id === identificationTypeId)) {
      setIdentificationTypeId('');
    }
  }, [identificationOptions, identificationTypeId]);

  // Qué campos de nombre se piden lo dice el catálogo, no un `if` sobre
  // "jurídica": "Establecimiento de comercio" también lleva razón social.
  const requiresBusinessName = personType?.requires_business_name ?? false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirm_password') as string;
    const email = formData.get('email') as string;

    if (password !== confirmPassword) {
      return;
    }

    setSubmittedEmail(email);

    try {
      await registerBuyer({
        email,
        password,
        person_type_id: personTypeId,
        identification_type_id: identificationTypeId,
        document_number: formData.get('document_number') as string,
        full_name: !requiresBusinessName ? (formData.get('full_name') as string) : undefined,
        business_name: requiresBusinessName ? (formData.get('business_name') as string) : undefined,
        contact_name: requiresBusinessName ? (formData.get('contact_name') as string) : undefined,
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
                  <p>{error}</p>

                  {/* Si el correo ya tiene cuenta, el aviso no basta: hay que
                      poder entrar desde aquí. El camino inverso (login →
                      registro) ya existía. */}
                  {errorCode === 'email_exists' && onLoginClick && (
                    <button
                      type="button"
                      onClick={() => onLoginClick(submittedEmail)}
                      className="mt-2 inline-flex items-center gap-1 font-semibold text-red-700 underline underline-offset-2 transition-colors hover:text-red-900"
                    >
                      Iniciar sesión
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Tipo de persona"
                  value={personTypeId}
                  onChange={(e) => setPersonTypeId(e.target.value)}
                  disabled={loadingTypes}
                  required
                >
                  <option value="" disabled>
                    {loadingTypes ? 'Cargando...' : 'Selecciona...'}
                  </option>
                  {personTypes.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>

                <Select label="¿Compras al detal o al por mayor?" value={buyerType} onChange={(e) => setBuyerType(e.target.value as BuyerType)}>
                  <option value="retail">Al detal (minorista)</option>
                  <option value="wholesale">Al por mayor (mayorista)</option>
                </Select>

                <Select
                  label="Tipo de identificación"
                  value={identificationTypeId}
                  onChange={(e) => setIdentificationTypeId(e.target.value)}
                  disabled={!personTypeId}
                  required
                >
                  <option value="" disabled>
                    {personTypeId ? 'Selecciona...' : 'Elige primero el tipo de persona'}
                  </option>
                  {identificationOptions.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </Select>

                <Input label="Número de identificación" name="document_number" placeholder="1234567890" required />

                {!requiresBusinessName && (
                  <Input label="Nombre completo" name="full_name" placeholder="Juan Pérez" required className="sm:col-span-2" />
                )}

                {requiresBusinessName && (
                  <>
                    <Input label="Razón social" name="business_name" placeholder="Restaurante El Sabor S.A.S." required />
                    <Input label="Nombre del contacto principal" name="contact_name" placeholder="Juan Pérez" required />
                  </>
                )}

                <Input label="Correo electrónico" name="email" type="email" placeholder="juan@correo.com" required className="sm:col-span-2" />

                <PhoneInput
                  label="Teléfono celular"
                  name="phone"
                  value={phone}
                  onChange={setPhone}
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
