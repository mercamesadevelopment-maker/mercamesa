import React from 'react';
import { cn } from '@/lib/utils/cn';

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
