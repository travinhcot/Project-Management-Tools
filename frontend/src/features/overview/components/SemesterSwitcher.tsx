"use client";

import { useRouter } from "next/navigation";
import { Pill } from "@/shared/components/Pill";

export interface SemesterOption {
  id: string;
  name: string;
  isCurrent: boolean;
}

/** Pill-styled native select that reloads the overview for the chosen semester. */
export function SemesterSwitcher({
  options,
  selectedId,
}: {
  options: SemesterOption[];
  selectedId: string;
}) {
  const router = useRouter();
  const selected = options.find((option) => option.id === selectedId);

  return (
    <div className="flex items-center gap-2">
      <label className="relative inline-flex h-7 items-center rounded-full bg-surface px-3 text-xs font-semibold text-ink focus-within:ring-2 focus-within:ring-accent">
        <span aria-hidden>{selected?.name} ▾</span>
        <select
          aria-label="Semester"
          value={selectedId}
          onChange={(event) => {
            const option = options.find((o) => o.id === event.target.value);
            router.push(
              option && !option.isCurrent
                ? `/overview?semester=${option.id}`
                : "/overview",
            );
          }}
          className="absolute inset-0 w-full cursor-pointer opacity-0"
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
              {option.isCurrent ? " (current)" : ""}
            </option>
          ))}
        </select>
      </label>
      {selected?.isCurrent && <Pill tone="success">● Active</Pill>}
    </div>
  );
}
