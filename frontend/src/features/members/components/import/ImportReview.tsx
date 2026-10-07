"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/components/Button";
import { Pill, type PillTone } from "@/shared/components/Pill";
import { getImportMissing, getImportRows } from "@/features/members/actions";
import type {
  ImportRowsPage,
  ImportRowStatus,
  ImportSummary,
  MissingMember,
} from "@/features/members/models/member";

type Filter = "all" | ImportRowStatus;

const STATUS_PILL: Record<ImportRowStatus, { tone: PillTone; label: string }> = {
  VALID: { tone: "success", label: "New" },
  UPDATE: { tone: "accent", label: "Update" },
  INVALID: { tone: "danger", label: "Invalid" },
  DUPLICATE: { tone: "amber", label: "Duplicate" },
};

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex min-w-0 flex-1 basis-[130px] flex-col gap-1 rounded-[10px] border border-line bg-surface px-[18px] py-[14px]">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function formatList(names: string[]): string {
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} and ${names.length - 3} more` : shown;
}

export function ImportReview({
  summary,
  deactivateMissing,
  onDeactivateMissingChange,
}: {
  summary: ImportSummary;
  deactivateMissing: boolean;
  onDeactivateMissingChange: (value: boolean) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState<{ key: string; data?: ImportRowsPage; error?: string }>();
  const [missing, setMissing] = useState<MissingMember[]>();
  const [showMissing, setShowMissing] = useState(false);
  const [missingError, setMissingError] = useState<string>();

  // Rows are paged on the backend; `loaded.key` tells which request the data belongs to.
  const key = `${summary.id}:${filter}:${page}`;
  useEffect(() => {
    let cancelled = false;
    getImportRows(summary.id, filter, page).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok ? { key, data: result.page } : { key, error: result.message },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [summary.id, filter, page, key]);

  const loading = loaded?.key !== key;
  const data = loaded?.data;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const skipped = summary.totalRows - summary.validRows - summary.updateRows;

  const filters: { value: Filter; label: string; count?: number }[] = [
    { value: "all", label: "All", count: summary.totalRows },
    { value: "VALID", label: "New", count: summary.validRows },
    { value: "UPDATE", label: "Updates", count: summary.updateRows },
    { value: "INVALID", label: "Invalid", count: summary.invalidRows },
    { value: "DUPLICATE", label: "Duplicates" },
  ];

  function chooseFilter(next: Filter) {
    setFilter(next);
    setPage(1);
  }

  async function toggleMissing() {
    const open = !showMissing;
    setShowMissing(open);
    if (open && !missing) {
      const result = await getImportMissing(summary.id);
      if (result.ok) setMissing(result.members);
      else setMissingError(result.message);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <SummaryCard label="Rows in file" value={summary.totalRows} tone="text-ink" />
        <SummaryCard label="New members" value={summary.validRows} tone="text-success" />
        <SummaryCard label="Updates" value={summary.updateRows} tone="text-accent" />
        <SummaryCard label="Skipped" value={skipped} tone="text-danger" />
        <SummaryCard label="Active, not in file" value={summary.missingActiveRows} tone="text-ink" />
      </div>

      <section
        aria-label="Import rows"
        className="flex flex-col rounded-[10px] border border-line bg-surface py-1.5"
      >
        <div role="group" aria-label="Filter rows" className="flex flex-wrap gap-2 px-4 py-2.5">
          {filters.map((item) => {
            const selected = filter === item.value;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={selected}
                onClick={() => chooseFilter(item.value)}
                className={`inline-flex h-[26px] items-center rounded-full px-2.5 text-xs font-semibold ${
                  selected ? "bg-ink text-white" : "bg-chrome text-muted hover:bg-line/60"
                }`}
              >
                {item.label}
                {item.count !== undefined ? ` ${item.count}` : ""}
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto" aria-busy={loading}>
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="text-[11px] font-bold text-muted">
                <th scope="col" className="w-[66px] px-4 py-2.5 font-bold">ROW</th>
                <th scope="col" className="w-[232px] py-2.5 pr-3 font-bold">FULL NAME</th>
                <th scope="col" className="w-[292px] py-2.5 pr-3 font-bold">EMAIL</th>
                <th scope="col" className="w-[160px] py-2.5 pr-3 font-bold">MAJOR</th>
                <th scope="col" className="w-[122px] py-2.5 pr-3 font-bold">STATUS</th>
                <th scope="col" className="py-2.5 pr-4 font-bold">NOTES</th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                data?.rows.map((row) => {
                  const pill = STATUS_PILL[row.status];
                  const invalid = row.status === "INVALID";
                  return (
                    <tr key={row.row} className="border-t border-line/60">
                      <td className="px-4 py-3 text-[13px] text-ink">{row.row}</td>
                      <td className="py-3 pr-3 text-[13px] text-ink">{row.fullName || "—"}</td>
                      <td className={`break-all py-3 pr-3 text-[13px] ${invalid ? "text-danger" : "text-ink"}`}>
                        {row.email || "—"}
                      </td>
                      <td className="py-3 pr-3 text-[13px] text-ink">{row.major ?? "—"}</td>
                      <td className="py-3 pr-3">
                        <Pill tone={pill.tone} size="sm">
                          {pill.label}
                        </Pill>
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted">{row.errors.join(" · ")}</td>
                    </tr>
                  );
                })}
              {(loading || !data || data.rows.length === 0 || loaded?.error) && (
                <tr className="border-t border-line/60">
                  <td colSpan={6} className="px-4 py-6 text-center text-xs text-muted">
                    {loading
                      ? "Loading rows…"
                      : loaded?.error
                        ? loaded.error
                        : "No rows in this view."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-1.5 pt-2.5">
          <p className="text-xs font-medium text-muted" aria-live="polite">
            {data
              ? `${data.total} ${data.total === 1 ? "row" : "rows"} · Page ${page} of ${pageCount}`
              : " "}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount || loading}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      {summary.missingActiveRows > 0 && (
        <div className="flex flex-col gap-3 rounded-[10px] border border-warn-line bg-warn-soft p-[18px]">
          <div className="flex flex-wrap items-center gap-[14px] sm:flex-nowrap">
            <input
              id="deactivate-missing"
              type="checkbox"
              checked={deactivateMissing}
              onChange={(event) => onDeactivateMissingChange(event.target.checked)}
              className="size-[18px] shrink-0 accent-[var(--color-primary)]"
            />
            <label htmlFor="deactivate-missing" className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold text-ink">
                Deactivate {summary.missingActiveRows} active{" "}
                {summary.missingActiveRows === 1 ? "member" : "members"} who{" "}
                {summary.missingActiveRows === 1 ? "is" : "are"} not in this file
              </span>
              <span className="text-xs text-muted">
                {missing
                  ? `${formatList(missing.map((member) => member.fullName))} lose project and file access. `
                  : "They lose project and file access. "}
                Off by default.
              </span>
            </label>
            <button
              type="button"
              aria-expanded={showMissing}
              onClick={toggleMissing}
              className="shrink-0 rounded-lg px-2.5 py-[7px] text-xs font-semibold text-accent hover:bg-accent-soft"
            >
              {showMissing ? "Hide list" : "View list"}
            </button>
          </div>
          {showMissing && (
            <>
              {missingError && (
                <p role="alert" className="pl-8 text-xs text-danger">
                  {missingError}
                </p>
              )}
              {!missing && !missingError && <p className="pl-8 text-xs text-muted">Loading…</p>}
              {missing && (
                <ul className="grid gap-x-6 gap-y-1 pl-8 text-xs text-ink sm:grid-cols-2">
                  {missing.map((member) => (
                    <li key={member.id} className="break-words">
                      {member.fullName} <span className="text-muted">· {member.email}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
