'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Button, Input } from '@/src/components/Shared';
import { useAccount } from '../hooks/use-account';
import { EmailChangeModal } from './email-change-modal';
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

  const avatarSrc = avatarPreview || profile?.avatarSignedUrl || null;

  return (
    <motion.div
      key="account"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-white p-8 rounded-[40px] border border-mm-crd shadow-sm"
    >
      <h2 className="text-3xl font-fraunces text-mm-g mb-8">Mi Cuenta</h2>

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
        <div className="flex items-center gap-6 mb-8">
          <div className="w-24 h-24 bg-mm-gll rounded-full flex items-center justify-center text-5xl border-4 border-white shadow-lg overflow-hidden relative">
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
          <Input
            label="Teléfono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-sm font-medium text-mm-txs ml-1">Tipo de identificación</label>
            <select
              value={identificationTypeId}
              onChange={(e) => setIdentificationTypeId(e.target.value)}
              disabled={identificationOptions.length === 0}
              className="px-4 py-2.5 rounded-xl border-1.5 border-mm-crd bg-white focus:border-mm-g focus:ring-2 focus:ring-mm-gll outline-none transition-all disabled:opacity-60"
            >
              <option value="" disabled>Selecciona...</option>
              {identificationOptions.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
            {profile?.person_types?.name && (
              <p className="text-xs text-mm-txw ml-1">
                Opciones válidas para {profile.person_types.name}.
              </p>
            )}
          </div>

          <Input
            label="Número de identificación"
            value={documentNumber}
            onChange={(e) => setDocumentNumber(e.target.value)}
          />

          <div className="sm:col-span-2 flex items-end gap-3">
            <div className="flex-grow">
              <Input label="Email" value={profile?.email || ''} disabled />
            </div>
            <Button
              variant="outline"
              size="md"
              type="button"
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

      <EmailChangeModal
        isOpen={showEmailChange}
        onClose={() => setShowEmailChange(false)}
        currentEmail={profile?.email || ''}
      />
    </motion.div>
  );
}
