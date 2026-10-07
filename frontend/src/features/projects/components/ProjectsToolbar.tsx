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
    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
      <label className="flex h-11 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-muted focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 col-span-2 md:w-[424px]">
        <span aria-hidden="true" className="text-xl leading-none">
          ⌕
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search projects or leaders"
          aria-label="Search projects or leaders"
          className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted sm:text-[13px]"
        />
      </label>
      <SelectBox
        label="Filter by type"
        value={type}
        onChange={onTypeChange}
        options={TYPE_FILTER_OPTIONS}
        className="h-11 w-full sm:w-[142px]"
      />
      <SelectBox
        label="Filter by status"
        value={status}
        onChange={onStatusChange}
        options={STATUS_FILTER_OPTIONS}
        className="h-11 w-full sm:w-[150px]"
      />
      <Button onClick={onCreate} className="col-span-2 h-11 w-full whitespace-pre sm:ml-auto sm:w-[150px]">
        {"+  New project"}
      </Button>
    </div>
  );
}
