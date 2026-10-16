"use client";

import type { MouseEvent, ReactNode } from "react";

const DURATION_MS = 1400;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Scrolls to an in-page `#id` slowly, easing in and out. */
function scrollToId(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  const start = window.scrollY;
  const end = Math.max(0, target.getBoundingClientRect().top + start);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo(0, end);
    return;
  }
  const began = performance.now();
  const step = (now: number) => {
    const progress = Math.min(1, (now - began) / DURATION_MS);
    window.scrollTo(0, start + (end - start) * easeInOutCubic(progress));
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function SmoothAnchor({
  href,
  className,
  onNavigate,
  children,
}: {
  href: string;
  className?: string;
  onNavigate?: () => void;
  children: ReactNode;
}) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onNavigate?.();
    scrollToId(href.replace(/^#/, ""));
  };

  return (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  );
}
