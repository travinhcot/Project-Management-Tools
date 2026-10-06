import { Button } from "@/shared/components/Button";
import { SelectBox } from "@/shared/components/Field";
import {
  PROJECT_STATUSES,
  STATUS_LABELS,
} from "@/features/projects/models/project";

export const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "software", label: "Software" },
  { value: "hardware", label: "Hardware" },
] as const;

export const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Status" },
  ...PROJECT_STATUSES.map((status) => ({
    value: status,
    label: STATUS_LABELS[status],
  })),
] as const;

export function ProjectsToolbar({
  query,
  onQueryChange,
  type,
  onTypeChange,
  status,
  onStatusChange,
  onCreate,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  type: string;
  onTypeChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex h-11 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-muted focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 sm:w-[424px]">
        <span aria-hidden="true" className="text-xl leading-none">
          ⌕
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search projects or leaders"
          aria-label="Search projects or leaders"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
        />
      </label>
      <SelectBox
        label="Filter by type"
        value={type}
        onChange={onTypeChange}
        options={TYPE_FILTER_OPTIONS}
        className="h-11 w-[142px]"
      />
      <SelectBox
        label="Filter by status"
        value={status}
        onChange={onStatusChange}
        options={STATUS_FILTER_OPTIONS}
        className="h-11 w-[150px]"
      />
      <Button onClick={onCreate} className="ml-auto h-11 w-[150px] whitespace-pre">
        {"+  New project"}
      </Button>
    </div>
  );
}
