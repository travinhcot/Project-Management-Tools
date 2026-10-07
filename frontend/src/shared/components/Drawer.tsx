"use client";

import { useId, useRef, type ReactNode } from "react";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";

export function Drawer({
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
    <div className="fixed inset-0 z-50 flex justify-end">
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
        className="relative flex h-dvh w-full max-w-[460px] flex-col gap-4 overflow-y-auto rounded-l-[10px] border border-line bg-surface p-4 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-[3px]">
            <h2 id={titleId} className="break-words text-xl font-semibold text-ink">
              {title}
            </h2>
            {subtitle && (
              <p className="whitespace-pre-wrap break-words text-xs font-medium text-muted">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-m-2 shrink-0 p-2 text-2xl leading-none text-muted hover:text-ink"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
