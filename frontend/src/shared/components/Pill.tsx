import type { ReactNode } from "react";

const tones = {
  neutral: "bg-chrome text-muted",
  surface: "bg-surface text-ink",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  amber: "bg-amber-soft text-amber",
} as const;

export type PillTone = keyof typeof tones;

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: PillTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex h-7 items-center whitespace-nowrap rounded-full px-3 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
