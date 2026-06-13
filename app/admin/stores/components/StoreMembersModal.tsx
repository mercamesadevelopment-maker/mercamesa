import React, { useState, useEffect } from 'react';
import { Mail, Trash2, Users, Clock, ShieldCheck, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/modal/modal';
import { Button, Input } from '@/src/components/Shared';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
}

interface Role {
  id: string;
  name: string;
  label: string;
}

interface Member {
  id: string;
  user_id: string;
  role_id: string;
  created_at: string;
  profiles: Profile | null;
  roles: Role | null;
}

interface Invitation {
  id: string;
  email: string;
  role_id: string;
  roles: Role;
  is_pending: boolean;
  created_at: string;
}

interface StoreMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  storeName: string;
}

const STORE_ROLES = [
  { id: '5cd37ab3-c7e2-40a7-8677-363935b51e5a', label: 'Dueño de Tienda' },
  { id: '8c87f324-1ed6-4d75-914f-cb66d9f12a45', label: 'Tendero' }
];

export function StoreMembersModal({ isOpen, onClose, storeId, storeName }: StoreMembersModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState(STORE_ROLES[1].id); // Default to 'seller' / Tendero

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/members`);
      const result = await res.json();
      if (res.ok && result.data) {
        setMembers(result.data.members || []);
        setInvitations(result.data.invitations || []);
      } else {
        console.error(result.error);
      }
    } catch (e) {
      console.error('Error fetching members:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && storeId) {
      fetchMembers();
    }
  }, [isOpen, storeId]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          role_id: roleId
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      if (result.invited) {
        alert('Invitación enviada por correo electrónico al nuevo usuario!');
      } else {
        alert('Usuario asignado exitosamente como miembro!');
      }

      setEmail('');
      fetchMembers();
    } catch (err: any) {
      alert(err.message || 'Error al agregar miembro');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, isInvite: boolean) => {
    const message = isInvite 
      ? '¿Estás seguro de cancelar esta invitación pendiente?' 
      : '¿Estás seguro de remover a este miembro de la tienda?';
      
    if (!confirm(message)) return;

    try {
      const param = isInvite ? `inviteId=${id}` : `memberId=${id}`;
      const res = await fetch(`/api/stores/${storeId}/members?${param}`, {
        method: 'DELETE',
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      fetchMembers();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Miembros - ${storeName}`}>
      <div className="p-6 space-y-6">
        
        {/* Formulario Agregar/Invitar */}
        <form onSubmit={handleAddMember} className="bg-mm-gbg border border-mm-crd rounded-2xl p-4 space-y-4">
          <h3 className="text-sm font-bold text-mm-g flex items-center gap-2">
            <Plus className="w-4 h-4" /> Asignar o Invitar Nuevo Miembro
          </h3>
          
          <div className="grid sm:grid-cols-2 gap-3">
            <Input 
              label="Correo Electrónico" 
              type="email" 
              name="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="usuario@correo.com" 
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-mm-txw ml-1">Rol en Tienda</label>
              <select 
                value={roleId} 
                onChange={(e) => setRoleId(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm h-[42px]"
              >
                {STORE_ROLES.map(r => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={submitting}>
              {submitting ? 'Procesando...' : 'Asignar / Invitar'}
            </Button>
          </div>
        </form>

        {/* Lista de Miembros */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-mm-g flex items-center gap-2">
            <Users className="w-4 h-4" /> Lista de Miembros Activos
          </h3>

          {loading ? (
            <div className="text-center py-6 text-sm text-mm-txw">Cargando miembros...</div>
          ) : members.length === 0 && invitations.length === 0 ? (
            <div className="text-center py-8 bg-mm-gbg border border-dashed border-mm-crd rounded-2xl text-sm text-mm-txw">
              No hay miembros asignados ni invitaciones pendientes para esta tienda.
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              
              {/* Miembros Activos */}
              {members.map((member) => (
                <div 
                  key={member.id} 
                  className="flex justify-between items-center bg-white border border-mm-crd rounded-xl p-3.5 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-mm-gbg rounded-lg flex items-center justify-center shrink-0 border border-mm-crd text-mm-g font-bold">
                      {member.profiles?.full_name?.charAt(0).toUpperCase() || 'M'}
                    </div>
                    <div>
                      <span className="font-bold text-sm text-mm-g block">
                        {member.profiles?.full_name || 'Sin nombre'}
                      </span>
                      <span className="text-xs text-mm-txw block">
                        {member.profiles?.email}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold px-2.5 py-1 bg-[#D8F3DC] text-[#1B4332] rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> {member.roles?.label || 'Tendero'}
                    </span>
                    <button 
                      onClick={() => handleDelete(member.id, false)}
                      className="p-1.5 hover:bg-red-50 text-mm-txw hover:text-r rounded-lg transition-colors"
                      title="Eliminar Miembro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Invitaciones Pendientes */}
              {invitations.map((invite) => (
                <div 
                  key={invite.id} 
                  className="flex justify-between items-center bg-[#FAFAF5] border border-dashed border-mm-crd rounded-xl p-3.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-yellow-50 rounded-lg flex items-center justify-center shrink-0 border border-yellow-200 text-yellow-600">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-mm-g block opacity-75">
                        {invite.email}
                      </span>
                      <span className="text-[10px] text-mm-txw font-bold uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pendiente de registro
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold px-2.5 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full">
                      {invite.roles?.label || 'Invitado'}
                    </span>
                    <button 
                      onClick={() => handleDelete(invite.id, true)}
                      className="p-1.5 hover:bg-red-50 text-mm-txw hover:text-r rounded-lg transition-colors"
                      title="Cancelar Invitación"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

            </div>
          )}
        </div>

        {/* Botón cerrar */}
        <div className="pt-2 flex justify-end">
          <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
            Cerrar
          </Button>
        </div>

      </div>
    </Modal>
  );
}
