"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileDownload } from "@/features/member/components/ResourceAction";
import { submitFinalPackage } from "@/features/member/actions";
import type { MemberResource } from "@/features/member/models/member";
import { formatSize } from "@/features/member/utils/format";

/**
 * Event and content projects end with a final package: one Excel workbook the team submits.
 * Anyone assigned to the project can submit; submitting again replaces the previous file.
 */
export function FinalPackageCard({
  projectId,
  current,
}: {
  projectId: string;
  current: MemberResource | undefined;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [pending, startSubmit] = useTransition();
  const submitted = current?.kind === "file" ? current : undefined;

  function choose(next: File | null) {
    setDone(false);
    setError(undefined);
    if (next && !next.name.toLowerCase().endsWith(".xlsx")) {
      setFile(null);
      setError("The final package must be an Excel file (.xlsx).");
      return;
    }
    if (next && next.size > 10 * 1024 * 1024) {
      setFile(null);
      setError("The file must be 10 MB or smaller.");
      return;
    }
    setFile(next);
  }

  function submit() {
    if (!file) return;
    const data = new FormData();
    data.set("file", file);
    setError(undefined);
    startSubmit(async () => {
      const result = await submitFinalPackage(projectId, data);
      if (!result.ok) return setError(result.message);
      setFile(null);
      if (input.current) input.current.value = "";
      setDone(true);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3.5 rounded-2xl bg-surface shadow-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-ink">Final package</h2>
        <p className="text-xs text-muted">
          Submit the finished package for this project as one Excel workbook (.xlsx, up to 10 MB).
          Anyone on the team can submit; a new file replaces the old one.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-lg bg-chrome px-4 py-3.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm font-semibold text-ink">
            {submitted ? "Submitted" : "Not submitted yet"}
          </p>
          <p className="break-words text-xs text-muted">
            {submitted
              ? `${submitted.filename} · ${formatSize(submitted.sizeBytes)}`
              : "Upload the package when your team is done."}
          </p>
        </div>
        {submitted && (
          <FileDownload projectId={projectId} fileId={submitted.fileId} style="primary">
            Download
          </FileDownload>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          ref={input}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label="Final package (Excel file)"
          onChange={(event) => choose(event.target.files?.[0] ?? null)}
          disabled={pending}
          className="min-w-0 flex-1 text-[13px] text-ink file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-ink"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!file || pending}
          className="rounded-lg bg-primary px-4 py-[9px] text-[13px] font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Submitting…" : submitted ? "Replace package" : "Submit package"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-danger-text">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-[13px] font-medium text-success">
          Package submitted.
        </p>
      )}
    </section>
  );
}
