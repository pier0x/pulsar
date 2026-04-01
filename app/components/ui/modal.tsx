import * as React from "react";
import { cn } from "~/lib/utils";
import { X } from "lucide-react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

function Modal({ open, onClose, title, children, className }: ModalProps) {
  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className={cn(
          "relative w-full max-w-[480px] mx-4",
          "bg-nd-surface border border-nd-border-visible rounded-[16px]",
          "p-6",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          {title && (
            <h2 className="text-subheading text-nd-text-display">{title}</h2>
          )}
          <button
            onClick={onClose}
            className="ml-auto text-nd-text-secondary hover:text-nd-text-primary transition-nd font-mono text-[13px] uppercase tracking-[0.06em] p-1 cursor-pointer"
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Content */}
        {children}
      </div>
    </div>
  );
}

export { Modal };
