"use client";

import { useRef, useState, type DragEvent } from "react";

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  );
}

/** Drag a CSV onto the zone, or click the upload icon to open the file explorer. */
export function ImportDropzone({
  busy,
  error,
  onFile,
}: {
  busy: boolean;
  error?: string;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center gap-3 rounded-[10px] border border-dashed px-6 py-12 text-center ${
          dragging ? "border-primary bg-accent-soft" : "border-line bg-surface"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          aria-label="Roster CSV file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            // Allow re-selecting the same file after fixing it.
            event.target.value = "";
          }}
          className="sr-only"
          tabIndex={-1}
        />
        <button
          type="button"
          aria-label="Upload roster CSV"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent transition-colors hover:bg-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        >
          <UploadIcon />
        </button>
        <p className="text-[15px] font-semibold text-ink">
          {busy
            ? "Reading file…"
            : dragging
              ? "Drop the file to upload"
              : "Drag your roster CSV here"}
        </p>
        <p className="text-[13px] text-muted">
          or click the upload icon to browse your files
        </p>
      </div>

      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}

      <p className="rounded-[10px] bg-accent-soft p-3 text-xs text-info-text">
        CSV up to 1 MB. Required columns: Full Name, Email. Optional: Department
        (Software or Hardware), Birth Year. Nothing changes until you review the
        rows and commit.
      </p>
    </div>
  );
}
