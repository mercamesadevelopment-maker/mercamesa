'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { KeyRound, LogOut } from 'lucide-react';
import { Button, Input, Select } from '@/src/components/Shared';
import { ConfirmModal } from '@/components/ui/confirm-modal/ConfirmModal';
import { PhoneInput } from '@/components/ui/phone-input/PhoneInput';
import { useAccount } from '../hooks/use-account';
import { EmailChangeModal } from './email-change-modal';
import { PasswordChangeModal } from './password-change-modal';
import { uploadImageDirect } from '@/lib/supabase/client-upload';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useIdentificationTypes } from '@/app/hooks/use-identification-types';

export function AccountTab() {
  return (
    <Suspense fallback={null}>
      <AccountTabContent />
    </Suspense>
  );
}

function AccountTabContent() {
  const searchParams = useSearchParams();
  const incomplete = searchParams.get('incomplete') === '1';
  const { profile, loading, saving, error, fetchProfile, saveProfile } = useAccount();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [identificationTypeId, setIdentificationTypeId] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const { personTypes, allIdentificationTypes } = useIdentificationTypes();

  // Solo se ofrecen las identificaciones válidas para el tipo de persona con el
  // que se registró el usuario. Ese tipo no se edita desde acá, así que cambiar
  // la identificación no sirve para saltarse la regla; el servidor la revalida.
  //
  // Los perfiles antiguos no tienen tipo de persona (el formulario de entonces
  // no lo pedía): sin él no hay regla que aplicar, y dejarlos con la lista vacía
  // sería impedirles editar su identificación para siempre.
  const identificationOptions = profile?.person_type_id
    ? personTypes.find((p) => p.id === profile.person_type_id)?.identification_types ?? []
    : allIdentificationTypes;
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [confirmSignOutAll, setConfirmSignOutAll] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setIdentificationTypeId(profile.identification_type_id || '');
      setDocumentNumber(profile.document_number || '');
    }
  }, [profile]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);

    const payload: Record<string, unknown> = {
      full_name: fullName,
      phone,
      document_number: documentNumber,
      ...(identificationTypeId && { identification_type_id: identificationTypeId }),
    };

    if (avatarFile) {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const path = `${user.id}/avatar-${Date.now()}.${avatarFile.name.split('.').pop()}`;
        await uploadImageDirect('avatars', path, avatarFile);
        payload.avatar_url = path;
      }
    }

    const ok = await saveProfile(payload);
    if (ok) {
      setAvatarFile(null);
      setSaved(true);
    }
  };

  // `scope: 'global'` revoca los tokens de refresco de TODAS las sesiones del
  // usuario, no solo la de este navegador. Es lo que se necesita ante una
  // sospecha de suplantación; sin el scope solo cerraría la sesión actual.
  const handleSignOutEverywhere = async () => {
    setSigningOutAll(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut({ scope: 'global' });
      router.push('/');
    } finally {
      setSigningOutAll(false);
    }
  };

  const avatarSrc = avatarPreview || profile?.avatarSignedUrl || null;

  return (
    <motion.div
      key="account"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-white p-5 sm:p-8 rounded-3xl sm:rounded-[40px] border border-mm-crd shadow-sm"
    >
      <h2 className="text-2xl sm:text-3xl font-fraunces text-mm-g mb-6 sm:mb-8">Mi Cuenta</h2>

      {incomplete && (
        <div className="mb-6 bg-amber-50 text-amber-800 text-sm font-medium px-4 py-3 rounded-2xl border border-amber-200">
          Completa tu documento de identidad para poder pagar tus pedidos.
        </div>
      )}

      {error && (
        <div className="mb-6 bg-rl text-r text-sm font-medium px-4 py-3 rounded-2xl">
          {error}
        </div>
      )}

      {saved && (
        <div className="mb-6 bg-okl text-ok text-sm font-medium px-4 py-3 rounded-2xl">
          Datos guardados correctamente.
        </div>
      )}

      <form className="space-y-6 max-w-xl" onSubmit={handleSubmit}>
        <div className="flex items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 bg-mm-gll rounded-full flex items-center justify-center text-4xl sm:text-5xl border-4 border-white shadow-lg overflow-hidden relative">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={fullName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              (fullName || 'CL').substring(0, 2).toUpperCase()
            )}
          </div>
          <div className="relative">
            <Button variant="outline" size="sm" type="button">
              Cambiar avatar
            </Button>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Nombre"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <PhoneInput label="Teléfono" value={phone} onChange={setPhone} />

          <div className="flex flex-col gap-1.5 w-full">
            <Select
              label="Tipo de identificación"
              value={identificationTypeId}
              onChange={(e) => setIdentificationTypeId(e.target.value)}
              disabled={identificationOptions.length === 0}
              className="disabled:opacity-60"
            >
              <option value="" disabled>Selecciona...</option>
              {identificationOptions.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </Select>
            {profile?.person_types?.name && (
              <p className="text-xs text-mm-txw ml-1">
                Opciones válidas para {profile.person_types.name}.
              </p>
            )}
          </div>

          <Input
            label="Número de identificación"
            inputMode="numeric"
            value={documentNumber}
            onChange={(e) => setDocumentNumber(e.target.value)}
          />

          {/* Apilado en móvil: en fila, "Cambiar correo" dejaba el campo con
              ~130px y el correo no se alcanzaba a leer. */}
          <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-grow min-w-0">
              <Input label="Email" value={profile?.email || ''} disabled />
            </div>
            <Button
              variant="outline"
              size="md"
              type="button"
              className="w-full sm:w-auto shrink-0 whitespace-nowrap"
              onClick={() => setShowEmailChange(true)}
            >
              Cambiar correo
            </Button>
          </div>
        </div>

        <Button type="submit" loading={loading || saving} className="w-full sm:w-auto px-12">
          Guardar cambios
        </Button>
      </form>

      <div className="mt-8 sm:mt-10 max-w-xl border-t border-mm-crd pt-6 sm:pt-8">
        <h3 className="mb-1 text-xl font-fraunces text-mm-g">Seguridad</h3>
        <p className="mb-4 sm:mb-6 text-sm text-mm-txs">
          Protege el acceso a tu cuenta.
        </p>

        {/* En móvil el botón baja a todo el ancho. Con `flex-wrap` quedaba
            suelto a la izquierda, y no se leía como la acción de esa fila. */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-mm-crd p-4">
            <div className="flex items-start gap-3 min-w-0">
              <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-mm-txw" />
              <div>
                <p className="text-sm font-bold text-mm-g">Contraseña</p>
                <p className="text-xs text-mm-txs">
                  Necesitarás tu contraseña actual para cambiarla.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="w-full sm:w-auto shrink-0 whitespace-nowrap"
              onClick={() => setShowPasswordChange(true)}
            >
              Cambiar contraseña
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-mm-crd p-4">
            <div className="flex items-start gap-3 min-w-0">
              <LogOut className="mt-0.5 h-5 w-5 shrink-0 text-mm-txw" />
              <div>
                <p className="text-sm font-bold text-mm-g">Sesiones activas</p>
                <p className="text-xs text-mm-txs">
                  Cierra tu sesión en todos los dispositivos si crees que alguien más entró a tu cuenta.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="w-full sm:w-auto shrink-0 whitespace-nowrap"
              onClick={() => setConfirmSignOutAll(true)}
            >
              Cerrar en todos
            </Button>
          </div>
        </div>
      </div>

      <EmailChangeModal
        isOpen={showEmailChange}
        onClose={() => setShowEmailChange(false)}
        currentEmail={profile?.email || ''}
      />

      <PasswordChangeModal
        isOpen={showPasswordChange}
        onClose={() => setShowPasswordChange(false)}
      />

      <ConfirmModal
        isOpen={confirmSignOutAll}
        onClose={() => setConfirmSignOutAll(false)}
        onConfirm={handleSignOutEverywhere}
        isLoading={signingOutAll}
        variant="danger"
        title="Cerrar sesión en todos los dispositivos"
        confirmText="Sí, cerrar todo"
        message={
          <>
            Se cerrará tu sesión en este y en cualquier otro dispositivo, y tendrás que
            volver a ingresar.
            {'\n\n'}
            Si sospechas que alguien más entró a tu cuenta,{' '}
            <span className="font-bold text-mm-g">cambia también tu contraseña</span>: de lo
            contrario podría volver a ingresar.
          </>
        }
      />
    </motion.div>
  );
}
