import { cn } from '@/lib/utils/cn';

/**
 * Sellos de la marca (caso de marca, lámina 11): el descuento en arcilla
 * («-38 %») y el ahorro en lima («Ahorras $18.400»).
 */
interface StampProps {
  children: React.ReactNode;
  tono?: 'descuento' | 'ahorro' | 'tinta';
  className?: string;
}

const TONOS = {
  descuento: 'bg-arcilla text-white',
  ahorro: 'bg-lima text-tinta',
  tinta: 'bg-tinta text-lima',
} as const;

export function Stamp({ children, tono = 'descuento', className }: StampProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold tracking-tight whitespace-nowrap',
        TONOS[tono],
        className
      )}
    >
      {children}
    </span>
  );
}
