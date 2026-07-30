'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Button, Input } from '@/src/components/Shared';
import { useAccount } from '../hooks/use-account';
import { EmailChangeModal } from './email-change-modal';

const DOCUMENT_TYPES = [
  { value: 'cedula', label: 'Cédula de ciudadanía' },
  { value: 'nit', label: 'NIT' },
  { value: 'cedula_extranjeria', label: 'Cédula de extranjería' },
  { value: 'pasaporte', label: 'Pasaporte' },
];

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
  const [documentType, setDocumentType] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
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
      setDocumentType(profile.document_type || '');
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

    const formData = new FormData();
    formData.append('full_name', fullName);
    formData.append('phone', phone);
    formData.append('document_type', documentType);
    formData.append('document_number', documentNumber);
    if (avatarFile) formData.append('avatar', avatarFile);

    const ok = await saveProfile(formData);
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
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="px-4 py-2.5 rounded-xl border-1.5 border-mm-crd bg-white focus:border-mm-g focus:ring-2 focus:ring-mm-gll outline-none transition-all"
            >
              <option value="" disabled>Selecciona...</option>
              {DOCUMENT_TYPES.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
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
