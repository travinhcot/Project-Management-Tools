"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { workspaceNav } from "@/config/navigation";

function NavIcon({ name }: { name: string }) {
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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-[234px] shrink-0 flex-col gap-3 border border-line bg-chrome p-5">
      <p className="text-[11px] font-bold text-muted">WORKSPACE</p>
      <nav className="mt-3 flex flex-col gap-3">
        {workspaceNav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
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
      <p className="mt-7 text-[11px] font-bold text-muted">TOOLS</p>
      <Link
        href="/overview"
        className="flex h-11 items-start gap-2 rounded-lg bg-accent-soft p-3 text-accent"
      >
        <span className="text-base font-bold leading-none">◈</span>
        <span className="text-[13px] font-semibold leading-none">
          Project Management
        </span>
      </Link>
    </aside>
  );
}
