import React from 'react';
import { cn } from '@/lib/utils/cn';

function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("w-4.5 h-4.5 border-2.5 border-white/30 border-t-white rounded-full animate-spin", className)} />
  );
}

export function Button({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md', 
  loading = false,
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'oro';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
}) {
  const variants = {
    primary: "bg-mm-g text-white hover:bg-mm-gm shadow-sm",
    secondary: "bg-mm-gll text-mm-g hover:bg-mm-gl hover:text-white",
    outline: "border-1.5 border-mm-g text-mm-g hover:bg-mm-gbg",
    ghost: "text-mm-g hover:bg-mm-gbg",
    danger: "bg-r text-white hover:brightness-90",
    oro: "bg-arcilla text-white hover:bg-arcilla-oscura",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-base",
    lg: "px-8 py-3.5 text-lg",
    xl: "px-10 py-4 text-xl",
  };
  // Ojo con el orden de `disabled` y `{...props}` de abajo: `disabled` va
  // DESPUÉS a propósito. Estando antes, el spread lo pisaba con el `disabled`
  // recibido —o con `undefined` si no venía ninguno—, así que `loading` no
  // deshabilitaba nada: el botón seguía clicleable con el spinner girando y un
  // doble clic mandaba dos peticiones.
  return (
    <button 
      className={cn(
        "rounded-full font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
      disabled={loading || props.disabled}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
