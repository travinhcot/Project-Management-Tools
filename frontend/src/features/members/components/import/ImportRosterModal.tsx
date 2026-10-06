"use client";

import { useState } from "react";
import { Button } from "@/shared/components/Button";
import { Modal } from "@/shared/components/Modal";
import { ImportDropzone } from "@/features/members/components/import/ImportDropzone";
import { ImportReview } from "@/features/members/components/import/ImportReview";
import type { Member } from "@/features/members/models/member";
import type { SemesterSummary } from "@/features/projects/models/project";
import { formatKickoff } from "@/features/projects/utils/format";
import {
  applyImport,
  buildPreview,
  validateCsvFile,
  type ImportPreview,
} from "@/features/members/utils/roster-import";

type Loaded = { file: File; preview: ImportPreview; uploadedAt: string };

function Stepper({ step }: { step: 1 | 2 }) {
  const items = [
    { n: 1, label: "Upload CSV" },
    { n: 2, label: "Review rows" },
    { n: 3, label: "Commit" },
  ];
  return (
    <ol aria-label="Import steps" className="flex items-center gap-2.5">
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

// Commit only changes local state until the roster import API is wired.
export function ImportRosterModal({
  semester,
  members,
  onClose,
  onCommit,
}: {
  semester: SemesterSummary;
  members: Member[];
  onClose: () => void;
  onCommit: (members: Member[]) => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [deactivateMissing, setDeactivateMissing] = useState(false);

  async function handleFile(file: File) {
    const problem = validateCsvFile(file);
    if (problem) return setError(problem);
    setBusy(true);
    setError(undefined);
    try {
      const result = buildPreview(await file.text(), members);
      if (!result.ok) return setError(result.error);
      setDeactivateMissing(false);
      setLoaded({
        file,
        preview: result.preview,
        uploadedAt: formatKickoff(new Date().toISOString()),
      });
    } catch {
      setError("We couldn't read that file. Try exporting it as CSV again.");
    } finally {
      setBusy(false);
    }
  }

  function discard() {
    setLoaded(null);
    setError(undefined);
  }

  const usable = loaded ? loaded.preview.counts.new + loaded.preview.counts.update : 0;

  return (
    <Modal
      title="Import roster"
      subtitle={
        loaded
          ? `Check every row before it changes the ${semester.name} roster.`
          : `Upload a CSV to add or update members in the ${semester.name} roster.`
      }
      onClose={onClose}
    >
      <Stepper step={loaded ? 2 : 1} />

      {loaded ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-surface p-[18px]">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="break-all text-[15px] font-semibold text-ink">
                {loaded.file.name}
              </p>
              <p className="text-xs text-muted">
                Uploaded {loaded.uploadedAt} · {semester.label}
              </p>
            </div>
            <span className="ml-auto inline-flex rounded-full bg-amber-soft px-2.5 py-1 text-xs font-semibold text-warn-text">
              Preview expires in 30 min
            </span>
          </div>

          <ImportReview
            preview={loaded.preview}
            deactivateMissing={deactivateMissing}
            onDeactivateMissingChange={setDeactivateMissing}
          />

          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[13px] text-muted">
              Invalid and duplicate rows are skipped. Nothing changes until you
              commit.
            </p>
            <div className="ml-auto flex gap-3">
              <Button variant="outline" onClick={discard}>
                Discard preview
              </Button>
              <Button
                disabled={usable === 0}
                onClick={() => {
                  onCommit(applyImport(members, loaded.preview, deactivateMissing));
                  onClose();
                }}
              >
                Commit {usable} {usable === 1 ? "row" : "rows"}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <ImportDropzone busy={busy} error={error} onFile={handleFile} />
      )}
    </Modal>
  );
}
