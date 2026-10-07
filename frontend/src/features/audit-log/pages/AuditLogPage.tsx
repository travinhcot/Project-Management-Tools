"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/shared/components/Button";
import { SelectBox, TextInput } from "@/shared/components/Field";
import { AuditDetailDrawer } from "@/features/audit-log/components/AuditDetailDrawer";
import { AuditTable } from "@/features/audit-log/components/AuditTable";
import type {
  AuditEvent,
  AuditFilterOptions,
  AuditFilters,
  AuditListPage,
} from "@/features/audit-log/models/audit-event";
import { humanize } from "@/features/audit-log/utils/format";

function queryOf(filters: AuditFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.action) params.set("action", filters.action);
  if (filters.entityType) params.set("entity_type", filters.entityType);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}

// Filters live in the URL and the list is fetched by the server component, so this page
// keeps no copy of the events; it only tracks which row's drawer is open.
export function AuditLogPage({
  list,
  filters,
  options,
}: {
  list: AuditListPage;
  filters: AuditFilters;
  options: AuditFilterOptions;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  function navigate(next: Partial<AuditFilters>) {
    const query = queryOf({ ...filters, page: 1, ...next }).toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const exportQuery = queryOf({ ...filters, page: 1 }).toString();
  const pageCount = Math.max(1, Math.ceil(list.total / list.size));
  const hasFilters = filters.action || filters.entityType || filters.from || filters.to;

  const withAll = (label: string, values: string[]) => [
    { value: "", label },
    ...values.map((value) => ({ value, label: humanize(value) })),
  ];

  return (
    <div className="flex flex-col gap-[22px]">
      <p className="whitespace-pre-wrap break-words text-[13px] font-medium text-muted">
        {"Workspace  /  Project Management  /  Audit log"}
      </p>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold sm:text-[30px] text-ink">Audit log</h1>
          <p className="text-sm text-muted">
            A read-only record of who did what. Times are shown in Ho Chi Minh City time.
          </p>
        </div>
        <a
          href={`/audit-log/export${exportQuery ? `?${exportQuery}` : ""}`}
          download
          className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-[18px] py-[11px] text-[13px] font-semibold text-ink transition-colors hover:bg-chrome"
        >
          Export CSV
        </a>
      </div>

      <div className="flex flex-wrap items-end gap-[14px]">
        <SelectBox
          label="Filter by action"
          value={filters.action}
          onChange={(value) => navigate({ action: value })}
          options={withAll("All actions", options.actions)}
          className="h-11 w-full sm:w-[230px]"
        />
        <SelectBox
          label="Filter by entity"
          value={filters.entityType}
          onChange={(value) => navigate({ entityType: value })}
          options={withAll("All entities", options.entityTypes)}
          className="h-11 w-full sm:w-[190px]"
        />
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          From
          <TextInput
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) => navigate({ from: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          To
          <TextInput
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) => navigate({ to: event.target.value })}
          />
        </label>
        {hasFilters && (
          <Button
            variant="outline"
            onClick={() => navigate({ action: "", entityType: "", from: "", to: "" })}
          >
            Clear filters
          </Button>
        )}
      </div>

      <p className="text-sm font-semibold text-ink" aria-live="polite">
        {list.total} {list.total === 1 ? "event" : "events"}
      </p>

      {list.events.length === 0 ? (
        <div className="rounded-2xl bg-surface shadow-card p-8 text-center text-[13px] text-muted">
          {hasFilters ? "No events match these filters." : "No events recorded yet."}
        </div>
      ) : (
        <AuditTable events={list.events} onSelect={setSelected} />
      )}

      {pageCount > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-end gap-3">
          <span className="text-xs text-muted">
            Page {list.page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={list.page <= 1}
            onClick={() => navigate({ page: list.page - 1 })}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={list.page >= pageCount}
            onClick={() => navigate({ page: list.page + 1 })}
          >
            Next
          </Button>
        </nav>
      )}

      {selected && <AuditDetailDrawer event={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
