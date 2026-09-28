import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
  emoji?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  label?: string;
  /**
   * Búsqueda contra el servidor.
   *
   * Con `onSearchChange` el componente deja de filtrar `options` por su cuenta y
   * se limita a mostrar lo que le pasen: quien lo usa se encarga de pedir los
   * resultados. Es para listas que no caben en el navegador —el inventario
   * completo son 3.746 productos— donde traerlas enteras solo para filtrarlas
   * acá es justamente lo que hay que evitar.
   *
   * Sin estas props el comportamiento es el de siempre.
   */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** Hay una búsqueda en curso. Solo se usa con `onSearchChange`. */
  loading?: boolean;
  /** Qué decir cuando no hay resultados. */
  emptyMessage?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  disabled = false,
  required = false,
  className = '',
  label,
  searchValue,
  onSearchChange,
  loading = false,
  emptyMessage = 'No se encontraron resultados.',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQueryLocal, setSearchQueryLocal] = useState('');

  // Controlado desde afuera cuando hay búsqueda contra el servidor.
  const busquedaRemota = typeof onSearchChange === 'function';
  const searchQuery = busquedaRemota ? searchValue ?? '' : searchQueryLocal;
  const setSearchQuery = busquedaRemota ? onSearchChange! : setSearchQueryLocal;
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const selectedOption = useMemo(() => {
    return options.find((opt) => String(opt.value) === String(value));
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    // Con búsqueda remota, `options` YA viene filtrado por el servidor: volver a
    // filtrarlo acá escondería resultados válidos (el servidor busca sin tildes
    // y esto no).
    if (busquedaRemota) return options;
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.group || '').toLowerCase().includes(query)
    );
  }, [options, searchQuery, busquedaRemota]);

  // Group options if any options have groups
  const groupedOptions = useMemo(() => {
    const groups: Record<string, SelectOption[]> = {};
    const ungrouped: SelectOption[] = [];

    filteredOptions.forEach((opt) => {
      if (opt.group) {
        if (!groups[opt.group]) {
          groups[opt.group] = [];
        }
        groups[opt.group].push(opt);
      } else {
        ungrouped.push(opt);
      }
    });

    return { groups, ungrouped };
  }, [filteredOptions]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="text-sm font-medium text-mm-txs ml-1">
          {label} {required && <span className="text-r">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-mm-crd bg-white text-sm focus:border-mm-g focus:ring-2 focus:ring-mm-g/10 outline-none transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed select-none min-h-[42px]"
        >
          {/* min-w-0 + truncate: las etiquetas traen "Producto (unidad) — Tienda" y
              pasan de 350px. Sin esto el span se niega a encogerse y saca barra de
              scroll horizontal dentro del cuerpo del modal. */}
          <span className={`min-w-0 truncate ${selectedOption ? 'text-mm-g font-semibold' : 'text-mm-txw'}`}>
            {selectedOption ? (
              <span className="flex items-center gap-2 min-w-0">
                {selectedOption.emoji && <span className="shrink-0">{selectedOption.emoji}</span>}
                <span className="truncate">{selectedOption.label}</span>
              </span>
            ) : (
              placeholder
            )}
          </span>
          <ChevronDown className={`w-4 h-4 shrink-0 text-mm-txw transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1.5 bg-white border border-mm-crd rounded-2xl shadow-xl max-h-72 overflow-hidden flex flex-col animate-fade-in">
            {/* Search Input bar */}
            <div className="p-2 border-b border-mm-crd flex items-center gap-2 bg-mm-gbg/10">
              <Search className="w-4 h-4 text-mm-txw shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar..."
                className="w-full bg-transparent border-none text-sm text-mm-g outline-none placeholder:text-mm-txw py-1"
              />
            </div>

            {/* Options List */}
            <div className="overflow-y-auto max-h-56 divide-y divide-mm-crd/30">
              {loading && filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-xs text-mm-txw font-medium">
                  Buscando...
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-xs text-mm-txw font-medium">
                  {emptyMessage}
                </div>
              ) : (
                <>
                  {/* Ungrouped options */}
                  {groupedOptions.ungrouped.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-all hover:bg-mm-gbg/30 text-left ${
                        String(value) === String(opt.value)
                          ? 'text-mm-g font-bold bg-mm-gbg/20'
                          : 'text-mm-g'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {opt.emoji && <span className="shrink-0">{opt.emoji}</span>}
                        <span className="truncate">{opt.label}</span>
                      </span>
                      {String(value) === String(opt.value) && (
                        <Check className="w-4 h-4 shrink-0 text-mm-g" />
                      )}
                    </button>
                  ))}

                  {/* Grouped options */}
                  {Object.entries(groupedOptions.groups).map(([groupName, opts]) => (
                    <div key={groupName} className="flex flex-col">
                      <div className="px-4 py-1.5 bg-mm-gbg/25 text-[10px] font-bold uppercase tracking-wider text-mm-txw border-y border-mm-crd/25">
                        {groupName}
                      </div>
                      {opts.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleSelect(opt.value)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-all hover:bg-mm-gbg/30 text-left ${
                            String(value) === String(opt.value)
                              ? 'text-mm-g font-bold bg-mm-gbg/20'
                              : 'text-mm-g'
                          }`}
                        >
                          <span className="flex items-center gap-2 pl-2 min-w-0">
                            {opt.emoji && <span className="shrink-0">{opt.emoji}</span>}
                            <span className="truncate">{opt.label}</span>
                          </span>
                          {String(value) === String(opt.value) && (
                            <Check className="w-4 h-4 shrink-0 text-mm-g" />
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
