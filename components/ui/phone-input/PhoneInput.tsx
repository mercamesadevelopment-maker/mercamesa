'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import {
  usePhoneInput,
  defaultCountries,
  parseCountry,
  guessCountryByPartialPhoneNumber,
} from 'react-international-phone';
import { cn } from '@/src/components/Shared';

interface PhoneInputProps {
  label?: string;
  /** Teléfono en E.164 (`+573001234567`). */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /**
   * Si viene, se renderiza un input oculto con ese nombre.
   *
   * `BuyerRegisterModal` lee su formulario con `FormData`, que solo ve campos
   * con `name`. Sin esto, ese formulario dejaría de recibir el teléfono.
   */
  name?: string;
  className?: string;
}

/** 'co' → 🇨🇴. Los emoji de bandera son dos letras en el rango de indicadores regionales. */
function flagEmoji(iso2: string): string {
  return iso2
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

const COUNTRIES = defaultCountries.map(parseCountry);

/**
 * Campo de teléfono con selector de indicativo.
 *
 * Se dibuja con los estilos del sistema en vez de usar el componente que trae
 * la librería: de ahí solo se toma el hook `usePhoneInput`, que aporta la
 * máscara por país y la conversión a E.164. Así el campo queda idéntico al
 * `Input` que tiene al lado.
 *
 * Las banderas son emoji derivados del ISO y no imágenes: la librería las trae
 * de un CDN, que sería una petición externa por bandera y un punto de fallo.
 */
export function PhoneInput({
  label,
  value,
  onChange,
  error,
  required,
  disabled,
  placeholder = '300 123 4567',
  name,
  className,
}: PhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { inputValue, country, setCountry, handlePhoneValueChange, inputRef } =
    usePhoneInput({
      defaultCountry: 'co',
      value,
      countries: defaultCountries,
      // El indicativo se muestra en el botón, así que el campo solo lleva el
      // número nacional. Sin esto se vería dos veces.
      disableDialCodeAndPrefix: true,
      onChange: (data) => onChange(data.phone),
    });

  // Cerrar al hacer clic fuera y con Escape: sin esto el desplegable se queda
  // abierto tapando el campo siguiente.
  useEffect(() => {
    if (!open) return;

    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setSearch('');
  }, [open]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase().replace(/^\+/, '');
    if (!term) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(term) || c.dialCode.includes(term)
    );
  }, [search]);

  /**
   * Pegar un número internacional completo cambia el país.
   *
   * Se resuelve acá y no se delega en la librería: con el indicativo fuera del
   * campo, lo que se pega llega sin prefijo y ya no habría con qué adivinar.
   */
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim();
    if (!pasted.startsWith('+')) return;

    const guess = guessCountryByPartialPhoneNumber({ phone: pasted, countries: defaultCountries });
    if (guess?.country) setCountry(guess.country.iso2);
  };

  return (
    <div className={cn('flex flex-col gap-1.5 w-full', className)}>
      {label && (
        <label className="text-sm font-medium text-mm-txs ml-1">
          {label}
          {required && <span className="text-r"> *</span>}
        </label>
      )}

      <div ref={containerRef} className="relative">
        {/* Mismo borde, radio y alto que `Input`, para que no se note que es otro control. */}
        <div
          className={cn(
            'flex items-stretch rounded-xl border-1.5 border-mm-crd bg-white transition-all',
            'focus-within:border-mm-g focus-within:ring-2 focus-within:ring-mm-gll',
            error && 'border-r ring-rl',
            disabled && 'opacity-60'
          )}
        >
          <button
            type="button"
            onClick={() => !disabled && setOpen((v) => !v)}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={`Indicativo: ${country.name} +${country.dialCode}`}
            className="flex items-center gap-1.5 pl-3 pr-2 py-2.5 text-mm-g shrink-0 rounded-l-xl hover:bg-mm-gbg/50 transition-colors disabled:cursor-not-allowed"
          >
            <span className="text-base leading-none">{flagEmoji(country.iso2)}</span>
            <span className="text-sm font-medium">+{country.dialCode}</span>
            <ChevronDown className={cn('w-3.5 h-3.5 text-mm-txw transition-transform', open && 'rotate-180')} />
          </button>

          <span className="my-2 w-px bg-mm-crd shrink-0" aria-hidden="true" />

          {/* text-base en móvil: iOS hace zoom al enfocar campos de menos de 16px. */}
          <input
            ref={inputRef}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={inputValue}
            onChange={handlePhoneValueChange}
            onPaste={handlePaste}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            className="flex-grow min-w-0 px-3 py-2.5 rounded-r-xl bg-transparent text-base sm:text-sm outline-none disabled:cursor-not-allowed"
          />
        </div>

        {open && (
          <div className="absolute z-50 mt-1 w-full max-w-xs rounded-xl border border-mm-crd bg-white shadow-lg">
            <div className="relative border-b border-mm-crd/60 p-2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-mm-txw" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar país o indicativo"
                className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-mm-gbg/40 text-base sm:text-xs outline-none"
              />
            </div>

            <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
              {filtered.map((c) => (
                <li key={c.iso2}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.iso2 === country.iso2}
                    onClick={() => {
                      setCountry(c.iso2);
                      setOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-mm-gbg',
                      c.iso2 === country.iso2 && 'bg-mm-gbg/60 font-bold'
                    )}
                  >
                    <span className="text-base leading-none">{flagEmoji(c.iso2)}</span>
                    <span className="flex-grow min-w-0 truncate text-mm-g">{c.name}</span>
                    <span className="text-xs text-mm-txw shrink-0">+{c.dialCode}</span>
                  </button>
                </li>
              ))}

              {filtered.length === 0 && (
                <li className="px-3 py-4 text-center text-xs text-mm-txw">Sin resultados</li>
              )}
            </ul>
          </div>
        )}

        {name && <input type="hidden" name={name} value={value} />}
      </div>

      {error && <span className="text-xs text-r ml-1">{error}</span>}
    </div>
  );
}
