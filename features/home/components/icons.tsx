/**
 * Los íconos del diseño de la página de inicio (docs/design/MercaMesa · Home.html),
 * copiados tal cual. Toman el color de `currentColor`.
 */

type IconProps = { size?: number; className?: string };

const stroke = (width: number) => ({
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: width,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function ArrowIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke(2.6)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function PlayIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function ChatIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke(2.2)}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </svg>
  );
}

export function CompareIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke(2.2)}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

export function HomeIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke(2.2)}>
      <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

export function MenuIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke(2.2)}>
      <path d="M4 8h16M4 16h16" />
    </svg>
  );
}

export function CloseIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke(2.2)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** El carrito de Carolina en la tarjeta del celular: el símbolo de la marca, como lo dibujó el diseño. */
export function CarolinaSymbol({ className }: { className?: string }) {
  return (
    <svg width={24} height={20} viewBox="0 0 240 200" className={className} aria-hidden="true">
      <path
        d="M14,63 L20.9,66 Q30,70 35.1,78.6 L67.8,133.3 Q76,147 92,147.3 L156,148.7 Q172,149 179.2,134.7 L196.7,100.5 Q203,88 195.9,75.9 L175.1,40.4 Q169,30 161.4,39.3 L137.6,68.7 Q130,78 121.8,69.3 L107.5,54 Q100,46 91.9,53.4 L63,80"
        fill="none"
        stroke="currentColor"
        strokeWidth={22}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={104} cy={178} r={13} fill="currentColor" />
      <circle cx={156} cy={178} r={13} fill="currentColor" />
    </svg>
  );
}
