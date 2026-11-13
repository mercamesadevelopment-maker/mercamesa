'use client';

import { useState } from 'react';
import { BrandLogo } from '@/components/ui/brand-logo';
import { cn } from '@/lib/utils/cn';
import { HOME_NAV } from '../content';
import { CloseIcon, MenuIcon } from './icons';

interface HomeHeaderProps {
  onLogin: () => void;
  onRegister: () => void;
  onNavigate: (anchor: string) => void;
}

/**
 * Escritorio (desde `xl`): las tres píldoras, el logo al centro, «Ingresar» y
 * «Crear cuenta». Por debajo de 1280 px las píldoras ya no caben en una línea, así
 * que va el del celular: logo, «Ingresar» y el menú, que despliega las mismas
 * anclas con el patrón del drawer del `Sidebar`.
 */
export function HomeHeader({ onLogin, onRegister, onNavigate }: HomeHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (anchor: string) => {
    setMenuOpen(false);
    onNavigate(anchor);
  };

  return (
    <>
      {/* Escritorio */}
      <header className="hidden flex-wrap items-center justify-between gap-4 py-[22px] xl:flex">
        <nav aria-label="Principal" className="flex flex-[1_1_260px] flex-wrap gap-[6px] text-[15px] font-semibold">
          {HOME_NAV.map((item) => (
            <a
              key={item.label}
              href={`#${item.anchor}`}
              onClick={(e) => {
                e.preventDefault();
                go(item.anchor);
              }}
              className="rounded-full bg-niebla px-[18px] py-[10px] text-tinta transition-colors hover:text-tinta-hover"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <a href="#inicio" aria-label="MercaMesa, inicio" className="flex">
          <BrandLogo className="text-[21px]" />
        </a>
        <div className="flex flex-[1_1_260px] items-center justify-end gap-[18px] text-[15px] font-semibold">
          <button type="button" onClick={onLogin} className="text-tinta transition-colors hover:text-tinta-hover">
            Ingresar
          </button>
          <button
            type="button"
            onClick={onRegister}
            className="inline-flex h-[46px] items-center rounded-full bg-tinta px-[22px] text-white"
          >
            Crear cuenta
          </button>
        </div>
      </header>

      {/* Celular */}
      <header className="flex items-center justify-between px-1 py-4 xl:hidden">
        <a href="#inicio" aria-label="MercaMesa, inicio" className="flex">
          <BrandLogo className="text-[15px]" />
        </a>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLogin}
            className="inline-flex h-11 items-center rounded-full bg-tinta px-[18px] text-sm font-bold text-white"
          >
            Ingresar
          </button>
          <button
            type="button"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="relative z-50 flex h-11 w-11 items-center justify-center rounded-full bg-niebla text-tinta"
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </header>

      {menuOpen && <div className="fixed inset-0 z-40 bg-black/40 xl:hidden" onClick={() => setMenuOpen(false)} />}
      <nav
        aria-label="Menú"
        className={cn(
          'fixed inset-x-0 top-0 z-40 rounded-b-[28px] bg-white px-[18px] pb-6 pt-[84px] transition-all duration-300 xl:hidden',
          // La sombra solo abierto: cerrado, se asomaría por el borde de arriba.
          menuOpen ? 'translate-y-0 shadow-xl' : 'pointer-events-none -translate-y-full'
        )}
      >
        <div className="flex flex-col gap-2 text-[15px] font-semibold">
          {HOME_NAV.map((item) => (
            <a
              key={item.label}
              href={`#${item.anchor}`}
              onClick={(e) => {
                e.preventDefault();
                go(item.anchor);
              }}
              className="rounded-full bg-niebla px-[18px] py-3 text-tinta"
            >
              {item.label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onRegister();
            }}
            className="mt-2 flex h-[54px] items-center justify-center rounded-full bg-tinta text-base font-bold text-white"
          >
            Crear cuenta
          </button>
        </div>
      </nav>
    </>
  );
}
