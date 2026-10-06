"use client";

import { useId, useRef, type ReactNode } from "react";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";

/** Centered dialog window; the Drawer's counterpart for wide, multi-step content. */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(panelRef, onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/30"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-full w-[960px] max-w-full flex-col gap-[22px] overflow-y-auto rounded-[10px] border border-line bg-canvas p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-[30px] font-bold text-ink">
              {title}
            </h2>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-2xl leading-none text-muted hover:text-ink"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
