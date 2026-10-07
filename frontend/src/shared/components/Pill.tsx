import type { ReactNode } from "react";

const tones = {
  neutral: "bg-chrome text-muted",
  surface: "bg-surface text-ink shadow-card",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  amber: "bg-amber-soft text-amber",
  cyan: "bg-cyan-soft text-cyan-text",
  violet: "bg-violet-soft text-violet-text",
  warn: "bg-warn-soft text-warn-text",
  done: "bg-done-soft text-done",
  danger: "bg-danger-soft text-danger-text",
} as const;

const sizes = {
  md: "h-7 px-3",
  sm: "h-[27px] px-[11px]",
} as const;

export type PillTone = keyof typeof tones;

export function Pill({
  tone = "neutral",
  size = "md",
  children,
}: {
  tone?: PillTone;
  size?: keyof typeof sizes;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full text-xs font-semibold ${sizes[size]} ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
