import { Pill } from "@/shared/components/Pill";
import {
  DEPARTMENT_LABELS,
  type Department,
} from "@/features/members/models/member";

const display = {
  software: { tone: "accent", glyph: "⌘" },
  hardware: { tone: "amber", glyph: "▦" },
} as const;

export function DepartmentPill({ department }: { department: Department }) {
  const { tone, glyph } = display[department];
  return (
    <Pill tone={tone} size="sm">
      <span aria-hidden="true" className="mr-1">
        {glyph}
      </span>
      {DEPARTMENT_LABELS[department]}
    </Pill>
  );
}
