import { Pill } from "@/shared/components/Pill";
import type { ProjectType } from "@/shared/models/project";

export const projectTypeMeta = {
  software: { label: "Software", icon: "⌘", tone: "accent", bar: "bg-primary" },
  hardware: { label: "Hardware", icon: "▦", tone: "cyan", bar: "bg-cyan" },
  research: { label: "Research", icon: "◈", tone: "violet", bar: "bg-violet" },
} as const;

export function ProjectTypePill({
  type,
  size,
}: {
  type: ProjectType;
  size?: "md" | "sm";
}) {
  const meta = projectTypeMeta[type];
  return (
    <Pill tone={meta.tone} size={size}>
      {meta.icon} {meta.label}
    </Pill>
  );
}
