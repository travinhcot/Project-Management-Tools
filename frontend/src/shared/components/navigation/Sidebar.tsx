"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { workspaceNav, type NavItem } from "@/config/navigation";

export function NavIcon({ name }: { name: string }) {
  const url = `url(/icons/${name}.svg)`;
  // Masked so the icon follows the text colour in both active and inactive states.
  return (
    <span
      aria-hidden="true"
      className="size-[18px] shrink-0 bg-current"
      style={{
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
      }}
    />
  );
}

export interface SidebarNote {
  title: string;
  body: string;
}

export interface SidebarProps {
  heading?: string;
  items?: readonly NavItem[];
  /** Links shown dimmed and not clickable (e.g. a member who is not on the roster). */
  disabledHrefs?: readonly string[];
  /** Where the "Project Management" tool link goes. */
  toolHref?: string;
  note?: SidebarNote;
}

export function Sidebar({
  heading = "WORKSPACE",
  items = workspaceNav,
  disabledHrefs = [],
  toolHref = "/overview",
  note,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[234px] shrink-0 flex-col gap-3 border border-line bg-sidebar p-5 md:flex">
      <p className="text-[11px] font-bold text-muted">{heading}</p>
      <nav className="mt-3 flex flex-col gap-3">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          if (disabledHrefs.includes(item.href)) {
            return (
              <span
                key={item.href}
                aria-disabled="true"
                className="flex h-[42px] shrink-0 items-start gap-2 whitespace-nowrap rounded-lg p-3 text-sm font-medium text-muted opacity-40"
              >
                <NavIcon name={item.icon} />
                {item.label}
              </span>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex h-[42px] shrink-0 items-start gap-2 whitespace-nowrap rounded-lg p-3 text-sm ${
                active
                  ? "bg-white/40 font-semibold text-accent"
                  : "font-medium text-muted hover:bg-white/40"
              }`}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-7 text-[11px] font-bold text-muted">TOOLS</p>
      <Link
        href={toolHref}
        className="flex h-11 items-start gap-2 rounded-lg bg-white/40 p-3 text-accent"
      >
        <span className="text-base font-bold leading-none">◈</span>
        <span className="text-[13px] font-semibold leading-none">
          Project Management
        </span>
      </Link>
      {note && (
        <div className="flex flex-col gap-1 rounded-lg bg-surface p-3 shadow-card">
          <p className="text-xs font-semibold text-ink">{note.title}</p>
          <p className="text-[11px] text-muted">{note.body}</p>
        </div>
      )}
    </aside>
  );
}
