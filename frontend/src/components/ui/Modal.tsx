import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

import { createPortal } from "react-dom";

export function Modal({
  isOpen,
  onClose,
  children,
  title,
  description,
  maxWidth = "md",
}: ModalProps) {
  // Close on escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby={title ? "modal-title" : undefined}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            className={cn(
              "relative w-full overflow-hidden rounded-2xl bg-bg-secondary border border-border shadow-2xl flex flex-col max-h-[90vh]",
              {
                "max-w-sm": maxWidth === "sm",
                "max-w-lg": maxWidth === "md",
                "max-w-2xl": maxWidth === "lg",
                "max-w-4xl": maxWidth === "xl",
              }
            )}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="space-y-1">
                {title && (
                  <h2 id="modal-title" className="text-xl font-semibold tracking-tight">
                    {title}
                  </h2>
                )}
                {description && (
                  <p className="text-sm text-text-secondary">{description}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

