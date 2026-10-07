import { Pill } from "@/shared/components/Pill";

export function SemesterBadge({
  name,
  active,
}: {
  name: string;
  active: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill tone="surface">{name} ▾</Pill>
      {active && <Pill tone="success">● Active</Pill>}
    </div>
  );
}
