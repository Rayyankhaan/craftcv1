import React, { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';

interface PopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  maxWidthClass?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
}

export const PopupModal: React.FC<PopupModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  maxWidthClass = 'max-w-lg',
  headerActions,
  children,
  bodyClassName = 'p-6',
}) => {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm"
          />

          {/* Elevated Pop-up Surface */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={{
              duration: prefersReducedMotion ? 0.01 : 0.2,
              ease: [0.16, 1, 0.3, 1],
            }}
            className={`relative z-10 w-full ${maxWidthClass} rounded-2xl bg-white border border-slate-200/90 shadow-[0_28px_70px_-15px_rgba(15,23,42,0.28)] overflow-hidden max-h-[90vh] flex flex-col`}
          >
            {(title || subtitle || headerActions) && (
              <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-white">
                <div className="min-w-0">
                  {title && (
                    <h2 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight truncate">
                      {title}
                    </h2>
                  )}
                  {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {headerActions}
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close pop-up"
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className={`overflow-y-auto subtle-scroll ${bodyClassName}`}>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
