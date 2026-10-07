"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, useState } from "react";
import { workspaceNav } from "@/config/navigation";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";
import { NavIcon } from "@/shared/components/navigation/Sidebar";

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="10.5" />
      <path d="M7 8.5h10M7 12h10M7 15.5h10" strokeLinecap="butt" />
    </svg>
  );
}

function WorkspaceDrawer({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(panelRef, onClose);

  return (
    <div className="fixed inset-0 z-50 flex justify-start md:hidden">
      <div className="absolute inset-0 bg-ink/30" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-dvh w-full max-w-[280px] flex-col gap-3 overflow-y-auto rounded-r-[10px] border border-line bg-chrome p-4"
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-[11px] font-bold text-muted">
            WORKSPACE
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-m-2 p-2 text-2xl leading-none text-muted hover:text-ink"
          >
            ×
          </button>
        </div>
        <nav className="flex flex-col gap-2">
          {workspaceNav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={`flex h-[42px] items-start gap-2 rounded-lg p-3 text-sm ${
                  active
                    ? "bg-accent-soft font-semibold text-accent"
                    : "font-medium text-muted hover:bg-accent-soft/60"
                }`}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/** Hamburger button (phones only) that opens the workspace menu as a left drawer. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Open workspace menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="-ml-1 rounded-full p-1 text-ink hover:bg-line/50 md:hidden"
      >
        <MenuIcon />
      </button>
      {open && <WorkspaceDrawer onClose={() => setOpen(false)} />}
    </>
  );
}
