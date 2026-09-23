import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

/**
 * Selección múltiple con buscador. Es el hermano de `SearchableSelect`, que solo
 * deja elegir uno: mismas clases, mismo buscador y mismo cierre al hacer clic
 * afuera, para que los dos desplegables de un mismo formulario se vean igual.
 */

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  /** Texto de ayuda bajo el campo. */
  hint?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  disabled = false,
  className = '',
  label,
  hint,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const selected = useMemo(
    () => options.filter((opt) => value.includes(opt.value)),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(query));
  }, [options, searchQuery]);

  // El desplegable NO se cierra al elegir: lo normal acá es marcar varias
  // seguidas, y cerrarse en cada una obligaría a reabrirlo cada vez.
  const toggle = (val: string) => {
    onChange(value.includes(val) ? value.filter((v) => v !== val) : [...value, val]);
  };

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`} ref={containerRef}>
      {label && <label className="text-sm font-medium text-mm-txs ml-1">{label}</label>}

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-mm-crd bg-white text-sm focus:border-mm-g focus:ring-2 focus:ring-mm-g/10 outline-none transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed select-none min-h-[42px]"
        >
          {selected.length === 0 ? (
            <span className="text-mm-txw">{placeholder}</span>
          ) : (
            <span className="flex flex-wrap gap-1.5">
              {selected.map((opt) => (
                <span
                  key={opt.value}
                  className="inline-flex items-center gap-1 rounded-lg bg-mm-gbg/50 px-2 py-0.5 text-xs font-semibold text-mm-g"
                >
                  {opt.label}
                  {/* Un div y no un button: esto ya vive dentro de un <button>. */}
                  <div
                    role="button"
                    tabIndex={-1}
                    aria-label={`Quitar ${opt.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(opt.value);
                    }}
                    className="cursor-pointer rounded-full p-0.5 hover:bg-mm-crd"
                  >
                    <X className="h-3 w-3" />
                  </div>
                </span>
              ))}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-mm-txw transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1.5 bg-white border border-mm-crd rounded-2xl shadow-xl max-h-72 overflow-hidden flex flex-col animate-fade-in">
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

            <div className="overflow-y-auto max-h-56 divide-y divide-mm-crd/30">
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-xs text-mm-txw font-medium">
                  No se encontraron resultados.
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = value.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggle(opt.value)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-all hover:bg-mm-gbg/30 text-left ${
                        isSelected ? 'text-mm-g font-bold bg-mm-gbg/20' : 'text-mm-g'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-mm-g" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {hint && <p className="ml-1 text-xs text-mm-txw">{hint}</p>}
    </div>
  );
}
