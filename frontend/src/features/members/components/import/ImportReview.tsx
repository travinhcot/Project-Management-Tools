"use client";

import { useMemo, useState } from "react";
import { Button } from "@/shared/components/Button";
import { Pill, type PillTone } from "@/shared/components/Pill";
import {
  formatList,
  type ImportPreview,
  type RowStatus,
} from "@/features/members/utils/roster-import";

const PAGE_SIZE = 5;

type Filter = "all" | RowStatus;

const STATUS_PILL: Record<RowStatus, { tone: PillTone; label: string }> = {
  new: { tone: "success", label: "New" },
  update: { tone: "accent", label: "Update" },
  invalid: { tone: "danger", label: "Invalid" },
  duplicate: { tone: "amber", label: "Duplicate" },
};

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 basis-[130px] flex-col gap-1 rounded-[10px] border border-line bg-surface px-[18px] py-[14px]">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

export function ImportReview({
  preview,
  deactivateMissing,
  onDeactivateMissingChange,
}: {
  preview: ImportPreview;
  deactivateMissing: boolean;
  onDeactivateMissingChange: (value: boolean) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [showMissing, setShowMissing] = useState(false);

  const { rows, counts, missing } = preview;

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((row) => row.status === filter)),
    [rows, filter],
  );
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: rows.length },
    { value: "new", label: "New", count: counts.new },
    { value: "update", label: "Updates", count: counts.update },
    { value: "invalid", label: "Invalid", count: counts.invalid },
    { value: "duplicate", label: "Duplicates", count: counts.duplicate },
  ];

  function chooseFilter(next: Filter) {
    setFilter(next);
    setPage(1);
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <SummaryCard label="Rows in file" value={rows.length} tone="text-ink" />
        <SummaryCard label="New members" value={counts.new} tone="text-success" />
        <SummaryCard label="Updates" value={counts.update} tone="text-accent" />
        <SummaryCard label="Invalid" value={counts.invalid} tone="text-danger" />
        <SummaryCard label="Duplicates" value={counts.duplicate} tone="text-warn-text" />
        <SummaryCard label="Active, not in file" value={missing.length} tone="text-ink" />
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
                {item.label} {item.count}
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="text-[11px] font-bold text-muted">
                <th scope="col" className="w-[66px] px-4 py-2.5 font-bold">ROW</th>
                <th scope="col" className="w-[232px] py-2.5 pr-3 font-bold">FULL NAME</th>
                <th scope="col" className="w-[292px] py-2.5 pr-3 font-bold">EMAIL</th>
                <th scope="col" className="w-[122px] py-2.5 pr-3 font-bold">STATUS</th>
                <th scope="col" className="py-2.5 pr-4 font-bold">NOTES</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const pill = STATUS_PILL[row.status];
                return (
                  <tr key={row.row} className="border-t border-line/60">
                    <td className="px-4 py-3 text-[13px] text-ink">{row.row}</td>
                    <td className="py-3 pr-3 text-[13px] text-ink">{row.fullName || "—"}</td>
                    <td
                      className={`py-3 pr-3 text-[13px] ${
                        row.status === "invalid" ? "text-danger" : "text-ink"
                      }`}
                    >
                      {row.email || "—"}
                    </td>
                    <td className="py-3 pr-3">
                      <Pill tone={pill.tone} size="sm">
                        {pill.label}
                      </Pill>
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted">{row.note}</td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr className="border-t border-line/60">
                  <td colSpan={5} className="px-4 py-6 text-center text-xs text-muted">
                    No rows in this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 pb-1.5 pt-2.5">
          <p className="whitespace-pre text-xs font-medium text-muted" aria-live="polite">
            {`Showing ${pageRows.length} of ${visible.length} rows  ·  Page ${current} of ${pageCount}`}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={current >= pageCount}
              onClick={() => setPage(current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      {missing.length > 0 && (
        <div className="flex flex-col gap-3 rounded-[10px] border border-warn-line bg-warn-soft p-[18px]">
          <div className="flex items-center gap-[14px]">
            <input
              id="deactivate-missing"
              type="checkbox"
              checked={deactivateMissing}
              onChange={(event) => onDeactivateMissingChange(event.target.checked)}
              className="size-[18px] shrink-0 accent-[var(--color-primary)]"
            />
            <label htmlFor="deactivate-missing" className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold text-ink">
                Deactivate {missing.length} active{" "}
                {missing.length === 1 ? "member" : "members"} who{" "}
                {missing.length === 1 ? "is" : "are"} not in this file
              </span>
              <span className="text-xs text-muted">
                {formatList(missing.map((member) => member.fullName))} lose
                project and file access. Off by default.
              </span>
            </label>
            <button
              type="button"
              aria-expanded={showMissing}
              onClick={() => setShowMissing((open) => !open)}
              className="shrink-0 rounded-lg px-2.5 py-[7px] text-xs font-semibold text-accent hover:bg-accent-soft"
            >
              {showMissing ? "Hide list" : "View list"}
            </button>
          </div>
          {showMissing && (
            <ul className="grid gap-x-6 gap-y-1 pl-8 text-xs text-ink sm:grid-cols-2">
              {missing.map((member) => (
                <li key={member.id}>
                  {member.fullName}{" "}
                  <span className="text-muted">· {member.email}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
