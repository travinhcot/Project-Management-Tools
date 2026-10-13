"use client";

import { useState } from "react";
import { LoadingLink } from "./LoadingLink";
import { SmoothAnchor } from "./SmoothAnchor";

const LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#features" },
  { label: "For members", href: "#cta" },
];

/** Top-bar links and actions; collapses into a menu on small screens. */
export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="hidden items-center gap-9 text-[15px] font-medium text-[#a7acc3] md:flex lg:absolute lg:left-1/2 lg:-translate-x-1/2">
        {LINKS.map((link) => (
          <SmoothAnchor key={link.label} href={link.href} className="transition hover:text-[#6ce7ff]">
            {link.label}
          </SmoothAnchor>
        ))}
      </nav>

      <div className="flex items-center gap-2 md:gap-3">
        <LoadingLink
          href="/sign-in"
          className="rounded-xl bg-[#6ce7ff] px-3.5 py-2 text-sm font-semibold text-[#171624] transition hover:brightness-110 md:px-5 md:py-2.5 md:text-base"
        >
          Sign in
        </LoadingLink>
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex flex-col gap-1 px-2 py-2.5 md:hidden"
        >
          <span className={`h-0.5 w-[18px] rounded bg-[#f2f7fc] transition ${open ? "translate-y-1.5 rotate-45" : ""}`} />
          <span className={`h-0.5 w-[18px] rounded bg-[#f2f7fc] transition ${open ? "opacity-0" : ""}`} />
          <span className={`h-0.5 w-[18px] rounded bg-[#f2f7fc] transition ${open ? "-translate-y-1.5 -rotate-45" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="nct-fade-down absolute inset-x-0 top-full z-20 flex flex-col gap-4 border-b border-[#f2f7fc]/10 bg-[#171624] px-5 py-5 md:hidden">
          {LINKS.map((link) => (
            <SmoothAnchor
              key={link.label}
              href={link.href}
              onNavigate={() => setOpen(false)}
              className="text-[15px] font-medium text-[#a7acc3]"
            >
              {link.label}
            </SmoothAnchor>
          ))}
        </div>
      )}
    </>
  );
}
