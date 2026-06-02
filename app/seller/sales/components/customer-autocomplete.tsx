import React, { useState, useEffect, useRef } from 'react';
import { Search, User, Mail, CreditCard, Phone, CheckCircle, Loader2 } from 'lucide-react';
import { searchClientByDocumentOrEmail, ClientData } from '../services/sales.service';

export interface CustomerState {
  name: string;
  id: string; // document_number
  email: string;
  phone: string;
  profile_id?: string | null;
}

interface CustomerAutocompleteProps {
  value: CustomerState;
  onChange: (customer: CustomerState) => void;
}

export function CustomerAutocomplete({ value, onChange }: CustomerAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [foundClient, setFoundClient] = useState<ClientData | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounce simple si no existiera en la ruta
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 3) {
      setFoundClient(null);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const client = await searchClientByDocumentOrEmail(searchTerm.trim());
        if (client) {
          setFoundClient(client);
        } else {
          setFoundClient(null);
        }
      } catch (err) {
        console.error('Error searching client:', err);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  // Manejar click fuera para cerrar dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectClient = (client: ClientData) => {
    onChange({
      name: client.full_name,
      id: client.document_number,
      email: client.email || '',
      phone: client.phone || '',
      profile_id: client.profile_id
    });
    setFoundClient(null);
    setSearchTerm('');
    setSearchFocused(false);
  };

  const handleInputChange = (field: keyof CustomerState, val: string) => {
    onChange({
      ...value,
      [field]: val
    });
  };

  return (
    <div ref={wrapperRef} className="space-y-4">
      <div className="flex items-center gap-2 text-mm-txw mb-1">
        <User className="w-4 h-4 text-mm-oro" />
        <span className="text-[10px] font-black uppercase tracking-widest leading-none">Búsqueda / Registro de Cliente</span>
      </div>

      {/* Input de Búsqueda Rápida */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-mm-txw" />
        <input
          type="text"
          placeholder="Buscar por Cédula/NIT o Email..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setSearchFocused(true);
          }}
          onFocus={() => setSearchFocused(true)}
          className="w-full bg-mm-gbg/20 border border-mm-crd rounded-2xl py-3 pl-11 pr-10 text-xs outline-none focus:ring-2 ring-mm-g/20 transition-all font-medium text-mm-g"
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-mm-oro animate-spin" />
        )}

        {/* Dropdown de Resultados */}
        {searchFocused && (foundClient || (searchTerm.length >= 3 && !loading && !foundClient)) && (
          <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-mm-crd shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto">
            {foundClient ? (
              <button
                type="button"
                onClick={() => handleSelectClient(foundClient)}
                className="w-full text-left px-5 py-4 hover:bg-mm-gbg/20 transition-colors flex items-center justify-between border-b border-mm-crd last:border-0 group"
              >
                <div>
                  <p className="text-sm font-bold text-mm-g group-hover:text-mm-g/80 transition-colors">
                    {foundClient.full_name}
                  </p>
                  <p className="text-[10px] text-mm-txw mt-1">
                    Cédula: {foundClient.document_number} {foundClient.email ? `| Email: ${foundClient.email}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {foundClient.profile_id && (
                    <span className="bg-mm-g/10 text-mm-g text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-mm-g/20">
                      Registrado
                    </span>
                  )}
                  <CheckCircle className="w-5 h-5 text-mm-g" />
                </div>
              </button>
            ) : (
              <div className="px-5 py-4 text-center text-xs text-mm-txw italic">
                No se encontró cliente. Puedes registrarlo abajo.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Formulario de Cliente Relleno */}
      <div className="bg-mm-gbg/10 p-5 rounded-3xl border border-mm-crd/50 space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-mm-txw ml-1 flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-mm-txw" /> Documento (Cédula/NIT)
            </label>
            <input
              type="text"
              placeholder="Ej: 10293847"
              value={value.id}
              onChange={(e) => handleInputChange('id', e.target.value)}
              className="w-full bg-white border border-mm-crd rounded-xl py-2.5 px-3 text-xs outline-none focus:ring-2 ring-mm-g/20 transition-all font-medium text-mm-g"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-mm-txw ml-1 flex items-center gap-1">
              <User className="w-3 h-3 text-mm-txw" /> Nombre Completo
            </label>
            <input
              type="text"
              placeholder="Ej: Juan Pérez"
              value={value.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full bg-white border border-mm-crd rounded-xl py-2.5 px-3 text-xs outline-none focus:ring-2 ring-mm-g/20 transition-all font-medium text-mm-g"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-mm-txw ml-1 flex items-center gap-1">
              <Mail className="w-3 h-3 text-mm-txw" /> Email
            </label>
            <input
              type="email"
              placeholder="correo@ejemplo.com"
              value={value.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="w-full bg-white border border-mm-crd rounded-xl py-2.5 px-3 text-xs outline-none focus:ring-2 ring-mm-g/20 transition-all font-medium text-mm-g"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-mm-txw ml-1 flex items-center gap-1">
              <Phone className="w-3 h-3 text-mm-txw" /> Teléfono
            </label>
            <input
              type="text"
              placeholder="Ej: 3001234567"
              value={value.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="w-full bg-white border border-mm-crd rounded-xl py-2.5 px-3 text-xs outline-none focus:ring-2 ring-mm-g/20 transition-all font-medium text-mm-g"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
