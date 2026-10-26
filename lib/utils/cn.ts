import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Junta clases de Tailwind: las condicionales de `clsx` y sin conflictos (`twMerge`). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
