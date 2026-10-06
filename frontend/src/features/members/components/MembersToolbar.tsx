import { Button } from "@/shared/components/Button";
import { SelectBox } from "@/shared/components/Field";
import {
  DEPARTMENTS,
  DEPARTMENT_LABELS,
} from "@/features/members/models/member";

export const DEPARTMENT_FILTER_OPTIONS = [
  { value: "all", label: "All departments" },
  ...DEPARTMENTS.map((department) => ({
    value: department,
    label: DEPARTMENT_LABELS[department],
  })),
] as const;

export function MembersToolbar({
  query,
  onQueryChange,
  department,
  onDepartmentChange,
  onImport,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  department: string;
  onDepartmentChange: (value: string) => void;
  onImport: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-[14px]">
      <label className="flex h-11 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-muted focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 sm:w-[600px]">
        <span aria-hidden="true" className="text-xl leading-none">
          ⌕
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search members by name or email"
          aria-label="Search members by name or email"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
        />
      </label>
      <SelectBox
        label="Filter by department"
        value={department}
        onChange={onDepartmentChange}
        options={DEPARTMENT_FILTER_OPTIONS}
        className="h-11 w-[184px]"
      />
      <Button onClick={onImport} className="ml-auto h-11 w-[160px]">
        Import roster
      </Button>
    </div>
  );
}
