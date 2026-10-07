import { Button } from "@/shared/components/Button";
import { SelectBox } from "@/shared/components/Field";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "all", label: "All statuses" },
] as const;

export function MembersToolbar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  onImport,
  onAdd,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  onImport: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-[14px] sm:flex sm:flex-wrap sm:items-center">
      <label className="flex h-11 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-muted focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 md:w-[480px]">
        <span aria-hidden="true" className="text-xl leading-none">
          ⌕
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search members by name or email"
          aria-label="Search members by name or email"
          className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted sm:text-[13px]"
        />
      </label>
      <SelectBox
        label="Filter by status"
        value={status}
        onChange={onStatusChange}
        options={STATUS_OPTIONS}
        className="h-11 w-full sm:w-[160px]"
      />
      <Button
        variant="outline"
        onClick={onAdd}
        className="h-11 w-full sm:ml-auto sm:w-[160px]"
      >
        Add member
      </Button>
      <Button onClick={onImport} className="h-11 w-full sm:w-[160px]">
        Import roster
      </Button>
    </div>
  );
}
