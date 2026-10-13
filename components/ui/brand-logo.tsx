import { cn } from '@/src/components/Shared';

/**
 * El logo de MercaMesa (MercaMesa_Branding_Case.pdf, láminas 7 y 8).
 *
 * El símbolo es un solo trazo: el mango del carrito (A), el canasto cuyo borde
 * sube y baja como la cordillera y forma la M (B), y dos ruedas (C). Grosor
 * constante, extremos redondos, ningún vértice en punta. Está redibujado a
 * partir del PDF; si el diseñador entrega el SVG original, se reemplaza el
 * `path` y nada más.
 *
 * Toma el color de `currentColor`: tinta sobre fondo claro, lima sobre tinta.
 */
export function BrandSymbol({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 100 78"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="none"
    >
      <path
        d="M8 20 L31.8 51.4 Q36 57 43 57 L65 57 Q72 57 75.9 51.2 L84.1 38.8 Q88 33 85.4 26.5 L78.8 9.7 Q77 5 74 9 L65 21 Q62 25 58.6 21.4 L50.4 12.6 Q47 9 43.8 12.8 L32 27"
        fill="none"
        stroke="currentColor"
        strokeWidth={11}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={45} cy={71} r={6.5} fill="currentColor" />
      <circle cx={67} cy={71} r={6.5} fill="currentColor" />
    </svg>
  );
}

interface BrandLogoProps {
  /** `claro`: sobre fondo claro (tinta y salvia). `oscuro`: sobre tinta (hueso y lima). */
  tono?: 'claro' | 'oscuro';
  /** Solo el símbolo, sin la palabra. */
  soloSimbolo?: boolean;
  className?: string;
}

/**
 * Logo horizontal: símbolo y «Merca» + «Mesa». La palabra va en texto con la
 * fuente de la marca (Poppins extrabold) y no como trazos, así se ve nítida en
 * cualquier tamaño y la lee un lector de pantalla.
 */
export function BrandLogo({ tono = 'claro', soloSimbolo = false, className }: BrandLogoProps) {
  const oscuro = tono === 'oscuro';
  return (
    <span className={cn('inline-flex items-center gap-2 select-none', className)}>
      <BrandSymbol
        className={cn('h-[1.6em] w-auto shrink-0', oscuro ? 'text-lima' : 'text-tinta')}
        title={soloSimbolo ? 'MercaMesa' : undefined}
      />
      {!soloSimbolo && (
        <span className="font-display font-extrabold tracking-[-0.04em] leading-none">
          <span className={oscuro ? 'text-hueso' : 'text-tinta'}>Merca</span>
          <span className={oscuro ? 'text-lima' : 'text-salvia'}>Mesa</span>
        </span>
      )}
    </span>
  );
}
