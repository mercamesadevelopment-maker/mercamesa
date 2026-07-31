'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { Button } from '@/src/components/Shared';
import { cn } from '@/src/components/Shared';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  hideCancel?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'warning',
  isLoading = false,
  hideCancel = false,
}: ConfirmModalProps) {
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <AlertCircle className="w-8 h-8 text-r" />;
      case 'info':
        return <Info className="w-8 h-8 text-blue" />;
      case 'warning':
      default:
        return <AlertTriangle className="w-8 h-8 text-amber-600" />;
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          iconBg: 'bg-rl/30',
          btnClass: 'bg-r hover:bg-r/90 text-white',
        };
      case 'info':
        return {
          iconBg: 'bg-bluel/30',
          btnClass: 'bg-blue hover:bg-blue/90 text-white',
        };
      case 'warning':
      default:
        return {
          iconBg: 'bg-amber-50',
          btnClass: 'bg-amber-600 hover:bg-amber-700 text-white',
        };
    }
  };

  const styles = getVariantStyles();

  const content = (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed z-[250] flex items-center justify-center p-4"
          style={{ inset: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-sm p-6 overflow-hidden flex flex-col items-center text-center z-10"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              disabled={isLoading}
              className="absolute top-4 right-4 p-1.5 hover:bg-mm-gbg rounded-full transition-colors text-mm-txs"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon */}
            <div className={cn('p-4 rounded-2xl mb-4 shrink-0', styles.iconBg)}>
              {getIcon()}
            </div>

            {/* Title & Message */}
            <h3 className="text-xl font-bold text-mm-g mb-2 leading-tight">
              {title}
            </h3>
            <p className="text-sm text-mm-txs leading-relaxed mb-6 whitespace-pre-line">
              {message}
            </p>

            {/* Actions */}
            <div className="flex gap-3 w-full">
              {!hideCancel && (
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 rounded-2xl h-12"
                >
                  {cancelText}
                </Button>
              )}
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={cn(
                  'flex-1 rounded-2xl font-bold text-sm h-12 transition-all flex items-center justify-center',
                  styles.btnClass
                )}
              >
                {isLoading ? 'Procesando...' : confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (typeof window === 'undefined') return null;
  return createPortal(content, document.body);
}
