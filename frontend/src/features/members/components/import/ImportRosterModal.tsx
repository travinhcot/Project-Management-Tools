"use client";

import { useState } from "react";
import { Button } from "@/shared/components/Button";
import { Modal } from "@/shared/components/Modal";
import { commitImport, uploadRosterImport } from "@/features/members/actions";
import { ImportDropzone } from "@/features/members/components/import/ImportDropzone";
import { ImportReview } from "@/features/members/components/import/ImportReview";
import type { ImportSummary } from "@/features/members/models/member";
import type { SemesterSummary } from "@/features/projects/models/project";
import { formatKickoff } from "@/features/projects/utils/format";
import { validateCsvFile } from "@/features/members/utils/roster-import";

function Stepper({ step }: { step: 1 | 2 }) {
  const items = [
    { n: 1, label: "Upload CSV" },
    { n: 2, label: "Review rows" },
    { n: 3, label: "Commit" },
  ];
  return (
    <ol aria-label="Import steps" className="flex flex-wrap items-center gap-2.5">
      {items.map((item, index) => {
        const done = item.n < step;
        const active = item.n === step;
        return (
          <li key={item.n} className="flex items-center gap-2.5">
            {index > 0 && (
              <span aria-hidden="true" className="text-sm text-placeholder">
                →
              </span>
            )}
            <span
              aria-current={active ? "step" : undefined}
              className={`inline-flex whitespace-pre rounded-full px-2.5 py-1 text-xs font-semibold ${
                done
                  ? "bg-success-soft text-success"
                  : active
                    ? "bg-primary text-white"
                    : "bg-chrome text-muted"
              }`}
            >
              {done ? "✓  " : `${item.n}  `}
              {item.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// Upload, review and commit all run against the backend; the preview lives there for 30 minutes.
export function ImportRosterModal({
  semester,
  onClose,
}: {
  semester: SemesterSummary;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [ignoredColumns, setIgnoredColumns] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [deactivateMissing, setDeactivateMissing] = useState(false);

  async function handleFile(file: File) {
    const problem = validateCsvFile(file);
    if (problem) return setError(problem);
    setUploading(true);
    setError(undefined);
    try {
      const data = new FormData();
      data.set("file", file);
      const result = await uploadRosterImport(semester.id, data);
      if (!result.ok) return setError(result.message);
      setDeactivateMissing(false);
      setIgnoredColumns(result.ignoredColumns);
      setSummary(result.summary);
    } catch {
      setError("We couldn't upload that file. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleCommit() {
    if (!summary) return;
    setCommitting(true);
    setError(undefined);
    try {
      const result = await commitImport(summary.id, deactivateMissing);
      if (result.ok) return onClose();
      setError(result.message);
    } finally {
      setCommitting(false);
    }
  }

  function discard() {
    setSummary(null);
    setIgnoredColumns([]);
    setError(undefined);
  }

  const usable = summary ? summary.validRows + summary.updateRows : 0;

  return (
    <Modal
      title="Import roster"
      subtitle={
        summary
          ? `Check every row before it changes the ${semester.name} roster.`
          : `Upload a CSV to add or update members in the ${semester.name} roster.`
      }
      onClose={onClose}
    >
      <Stepper step={summary ? 2 : 1} />

      {summary ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-surface p-[18px]">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="break-all text-[15px] font-semibold text-ink">{summary.filename}</p>
              <p className="text-xs text-muted">
                Uploaded {formatKickoff(summary.createdAt)} · {semester.label}
              </p>
            </div>
            <span className="inline-flex rounded-full bg-amber-soft px-2.5 py-1 text-xs font-semibold text-warn-text sm:ml-auto">
              Preview expires {formatKickoff(summary.expiresAt)} UTC
            </span>
          </div>

          {ignoredColumns.length > 0 && (
            <p className="rounded-[10px] bg-accent-soft p-3 text-xs text-info-text">
              Ignored columns: {ignoredColumns.join(", ")}.
            </p>
          )}

          <ImportReview
            summary={summary}
            deactivateMissing={deactivateMissing}
            onDeactivateMissingChange={setDeactivateMissing}
          />

          {error && (
            <p role="alert" className="text-xs font-medium text-danger">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[13px] text-muted">
              Invalid and duplicate rows are skipped. Nothing changes until you commit.
            </p>
            <div className="flex flex-wrap gap-3 sm:ml-auto">
              <Button variant="outline" onClick={discard} disabled={committing}>
                Discard preview
              </Button>
              <Button disabled={usable === 0 || committing} onClick={handleCommit}>
                {committing
                  ? "Committing…"
                  : `Commit ${usable} ${usable === 1 ? "row" : "rows"}`}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <ImportDropzone busy={uploading} error={error} onFile={handleFile} />
      )}
    </Modal>
  );
}
