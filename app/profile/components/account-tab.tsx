'use client';

import { motion } from 'motion/react';
import { useApp } from '@/src/store';
import { Button, Input } from '@/src/components/Shared';

export function AccountTab() {
  const { state } = useApp();
  const profile = state.buyerProfile;

  return (
    <motion.div
      key="account"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-white p-8 rounded-[40px] border border-mm-crd shadow-sm"
    >
      <h2 className="text-3xl font-fraunces text-mm-g mb-8">Mi Cuenta</h2>
      <form className="space-y-6 max-w-xl">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-24 h-24 bg-mm-gll rounded-full flex items-center justify-center text-5xl border-4 border-white shadow-lg overflow-hidden">
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt={profile.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              profile.avatar
            )}
          </div>
          <Button variant="outline" size="sm">
            Cambiar avatar
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Nombre" defaultValue={profile.name} />
          <Input label="Teléfono" defaultValue={profile.phone} />
          <Input label="Email" defaultValue={profile.email} className="sm:col-span-2" />
        </div>
        <Button className="w-full sm:w-auto px-12">Guardar cambios</Button>
      </form>
    </motion.div>
  );
}
