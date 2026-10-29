import React from 'react';
import { cn } from '@/lib/utils/cn';

export function StepBar({ step, total, color = "#0E3B2F" }: { step: number; total: number; color?: string }) {
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
