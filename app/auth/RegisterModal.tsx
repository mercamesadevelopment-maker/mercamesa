import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/src/store';
import { ROLES, C } from '@/src/constants';
import { RoleKey } from '@/src/types';
import { Button, Input, StepBar } from '@/src/components/Shared';
import { useAuthHooks } from '../hooks/useAuth';

export function RegisterModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { dispatch } = useApp();
  const { register, loading, error } = useAuthHooks();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<RoleKey | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    business_name: '',
    nit: '',
    store_name: '',
    local_number: '',
    vehicle: '',
    city: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;

    try {
      // Ideally map role to UUID based on DB roles. Hardcoded demo mapping or rely on context:
      const roleMap: Record<string, string> = {
        'admin': '4c68886c-5db2-4da5-8b9e-c5d5bb7fd906',
        'provider': '8c87f324-1ed6-4d75-914f-cb66d9f12a45', // seller
        'retail': 'cbcbbeb3-fe2a-45a8-abe6-8e1921af5eb1', // buyer
        'wholesale': 'cbcbbeb3-fe2a-45a8-abe6-8e1921af5eb1', // buyer
        'delivery': 'f10a6711-a0f8-4ab9-b199-ffb1ebcbce84',
      };

      await register({
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        phone: formData.phone,
        role_id: roleMap[role] || roleMap['retail'],
        roleKey: role
      });
      
      setStep(2);
    } catch (err) {
      // Handled in hook
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
        className="relative bg-white rounded-[32px] shadow-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors z-10">
          <X className="w-6 h-6 text-mm-txs" />
        </button>

        <div className="p-8 md:p-12 overflow-y-auto">
          <div className="max-w-2xl mx-auto w-full">
            <StepBar step={step} total={3} color={role ? ROLES.find(r => r.k === role)?.color : C.g} />

            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="step0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="text-3xl font-fraunces text-mm-g mb-2 text-center">Elige tu rol</h2>
                  <p className="text-mm-txs mb-8 text-center">Selecciona cómo quieres participar en MercaMesa.</p>
                  
                  <div className="grid sm:grid-cols-2 gap-4">
                    {ROLES.filter(r => r.k !== 'admin').map((r) => (
                      <button
                        key={r.k}
                        onClick={() => { setRole(r.k); setStep(1); }}
                        className="p-6 rounded-3xl border-2 border-mm-crd hover:border-mm-g transition-all text-left group flex flex-col items-center text-center"
                        style={{ borderColor: role === r.k ? r.color : undefined }}
                      >
                        <div className="text-5xl mb-4 p-4 rounded-2xl group-hover:scale-110 transition-transform" style={{ backgroundColor: r.bg }}>
                          {r.emoji}
                        </div>
                        <h3 className="text-lg font-bold mb-1" style={{ color: r.color }}>{r.title}</h3>
                        <p className="text-xs text-mm-txs">{r.sub}</p>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 1 && role && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="text-3xl font-fraunces text-mm-g mb-2 text-center">Completa tu perfil</h2>
                  <p className="text-mm-txs mb-8 text-center">Estás registrándote como <span className="font-bold" style={{ color: ROLES.find(r => r.k === role)?.color }}>{ROLES.find(r => r.k === role)?.title}</span>.</p>
                  
                  {error && <div className="mb-4 p-3 bg-red-100 text-red-600 rounded-xl text-sm">{error}</div>}

                  <form onSubmit={handleRegister} className="grid sm:grid-cols-2 gap-4">
                    <Input label="Nombre completo" name="full_name" value={formData.full_name} onChange={handleChange} placeholder="Juan Pérez" required />
                    <Input label="Celular" name="phone" value={formData.phone} onChange={handleChange} placeholder="+57 300 000 0000" required />
                    {role === 'wholesale' && <Input label="Nombre del negocio" name="business_name" value={formData.business_name} onChange={handleChange} placeholder="Restaurante El Sabor" required />}
                    {role === 'wholesale' && <Input label="NIT" name="nit" value={formData.nit} onChange={handleChange} placeholder="900.000.000-1" required />}
                    {role === 'provider' && <Input label="Nombre de la tienda" name="store_name" value={formData.store_name} onChange={handleChange} placeholder="Frutas Don Pepe" required />}
                    {role === 'provider' && <Input label="Número de local" name="local_number" value={formData.local_number} onChange={handleChange} placeholder="A-102" required />}
                    {role === 'delivery' && <Input label="Vehículo" name="vehicle" value={formData.vehicle} onChange={handleChange} placeholder="Moto / Bicicleta" required />}
                    <Input label="Ciudad" name="city" value={formData.city} onChange={handleChange} placeholder="Medellín" required />
                    <Input label="Correo electrónico" name="email" value={formData.email} onChange={handleChange} type="email" placeholder="juan@correo.com" required className="sm:col-span-2" />
                    <Input label="Contraseña" name="password" value={formData.password} onChange={handleChange} type="password" placeholder="••••••••" required />
                    <Input label="Confirmar contraseña" type="password" placeholder="••••••••" required />
                    
                    <div className="sm:col-span-2 flex items-center gap-2 text-xs text-mm-txs mt-2">
                      <input type="checkbox" required className="rounded border-mm-crd text-mm-g focus:ring-mm-g" />
                      Acepto los términos y condiciones y la política de privacidad.
                    </div>

                    <div className="sm:col-span-2 flex gap-4 mt-6">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(0)}>Atrás</Button>
                      <Button type="submit" className="flex-1" loading={loading} style={{ backgroundColor: ROLES.find(r => r.k === role)?.color }}>Crear cuenta</Button>
                    </div>
                  </form>
                </motion.div>
              )}

              {step === 2 && role && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8"
                >
                  <div className="text-8xl mb-6 animate-pop-in inline-block">{ROLES.find(r => r.k === role)?.emoji}</div>
                  <h2 className="text-4xl font-fraunces text-mm-g mb-4">¡Listo, bienvenido! 🎉</h2>
                  <p className="text-mm-txs mb-10 max-w-md mx-auto">Tu cuenta de {ROLES.find(r => r.k === role)?.title} ha sido creada con éxito. Ya puedes empezar a disfrutar de MercaMesa.</p>
                  
                  <div className="grid sm:grid-cols-2 gap-4 mb-10 text-left">
                    {ROLES.find(r => r.k === role)?.perks.map((perk, i) => (
                      <div key={i} className="p-4 rounded-2xl flex items-center gap-3" style={{ backgroundColor: ROLES.find(r => r.k === role)?.bg }}>
                        <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: ROLES.find(r => r.k === role)?.color }} />
                        <span className="text-sm font-medium" style={{ color: ROLES.find(r => r.k === role)?.color }}>{perk}</span>
                      </div>
                    ))}
                  </div>

                  <Button 
                    size="lg" 
                    className="w-full max-w-xs" 
                    style={{ backgroundColor: ROLES.find(r => r.k === role)?.color }}
                    onClick={() => {
                      dispatch({ type: 'LOGIN', role });
                      onClose();
                    }}
                  >
                    Entrar a mi cuenta →
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
