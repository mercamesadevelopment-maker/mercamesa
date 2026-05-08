import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("w-4.5 h-4.5 border-2.5 border-white/30 border-t-white rounded-full animate-spin", className)} />
  );
}

export function Badge({ children, className, variant = 'default', style }: { 
  children: React.ReactNode; 
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'oro';
  style?: React.CSSProperties;
}) {
  const variants = {
    default: "bg-mm-gbg text-mm-g",
    success: "bg-okl text-ok",
    warning: "bg-warnl text-warn",
    error: "bg-rl text-r",
    info: "bg-bluel text-blue",
    oro: "bg-mm-orl text-mm-oro",
  };
  return (
    <span 
      className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", variants[variant], className)}
      style={style}
    >
      {children}
    </span>
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
    danger: "bg-r text-white hover:bg-red-700",
    oro: "bg-mm-oro text-white hover:bg-amber-600",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-base",
    lg: "px-8 py-3.5 text-lg",
    xl: "px-10 py-4 text-xl",
  };
  return (
    <button 
      className={cn(
        "rounded-full font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

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

export function StepBar({ step, total, color = "#2A4E12" }: { step: number; total: number; color?: string }) {
  return (
    <div className="flex items-center justify-between w-full max-w-xs mx-auto mb-8 relative">
      <div className="absolute top-1/2 left-0 w-full h-0.5 bg-mm-crd -translate-y-1/2 z-0" />
      <div 
        className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 z-0 transition-all duration-500" 
        style={{ width: `${(step / (total - 1)) * 100}%`, backgroundColor: color }}
      />
      {Array.from({ length: total }).map((_, i) => (
        <div 
          key={i}
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold z-10 transition-all duration-300",
            i < step ? "bg-mm-g text-white" : i === step ? "bg-white border-2 text-mm-g" : "bg-mm-crd text-mm-txw"
          )}
          style={i === step ? { borderColor: color, color: color, boxShadow: `0 0 10px ${color}44` } : i < step ? { backgroundColor: color } : {}}
        >
          {i < step ? "✓" : i + 1}
        </div>
      ))}
    </div>
  );
}
