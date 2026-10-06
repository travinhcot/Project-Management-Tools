import { Pill } from "@/shared/components/Pill";
import type { ProjectType } from "@/shared/models/project";

export const projectTypeMeta = {
  software: { label: "Software", icon: "⌘", tone: "accent", bar: "bg-primary" },
  hardware: { label: "Hardware", icon: "▦", tone: "amber", bar: "bg-amber" },
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
