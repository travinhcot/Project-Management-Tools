"use client";

import { useState } from "react";
import { createDownload } from "@/features/department-resources/actions";

/** Downloads a department library file linked to the project; the signed link is made on click. */
export function LinkedResourceDownload({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const result = await createDownload(null, id);
      if (result.ok) window.location.assign(result.url);
      else setError(result.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="whitespace-nowrap rounded-lg bg-primary px-4 py-[9px] text-[13px] font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? "Preparing…" : "Download"}
      </button>
      {error && (
        <span role="alert" className="text-[11px] font-medium text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
