import React from 'react';
import { cn } from '@/lib/utils/cn';

export function Input({ label, error, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-sm font-medium text-mm-txs ml-1">{label}</label>}
      <input 
        className={cn(
          "px-4 py-2.5 rounded-xl border-1.5 border-mm-crd bg-white focus:border-mm-g focus:ring-2 focus:ring-mm-gll outline-none transition-all",
          error && "border-r ring-rl",
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-r ml-1">{error}</span>}
    </div>
  );
}

/**
 * Desplegable con la misma etiqueta y el mismo borde que `Input`, para que un
 * formulario que mezcla los dos no se vea a dos aguas.
 *
 * Estaba definido dentro de BuyerRegisterModal; se subió acá al necesitarlo
 * también el formulario de invitación.
 */
export function Select({ label, error, className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-sm font-medium text-mm-txs ml-1">{label}</label>}
      <select
        className={cn(
          "px-4 py-2.5 rounded-xl border-1.5 border-mm-crd bg-white focus:border-mm-g focus:ring-2 focus:ring-mm-gll outline-none transition-all",
          error && "border-r ring-rl",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-r ml-1">{error}</span>}
    </div>
  );
}

/**
 * Campo de texto largo, con la misma etiqueta y el mismo borde que `Input`.
 *
 * Existe por lo mismo que `Select`: un formulario que mezcla los dos no puede
 * verse a dos aguas. El repo tiene varios `<textarea>` sueltos, cada uno con sus
 * clases; los nuevos deberían usar este.
 *
 * `text-base sm:text-sm`: por debajo de 16 px iOS hace zoom al enfocar el campo
 * y descuadra el formulario, igual que en `PhoneInput`.
 */
export function Textarea({ label, error, hint, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-sm font-medium text-mm-txs ml-1">{label}</label>}
      <textarea
        className={cn(
          "px-4 py-2.5 rounded-xl border-1.5 border-mm-crd bg-white text-base sm:text-sm focus:border-mm-g focus:ring-2 focus:ring-mm-gll outline-none transition-all resize-none",
          error && "border-r ring-rl",
          className
        )}
        {...props}
      />
      {error ? (
        <span className="text-xs text-r ml-1">{error}</span>
      ) : (
        hint && <span className="text-xs text-mm-txw ml-1">{hint}</span>
      )}
    </div>
  );
}
