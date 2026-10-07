"use client";

import { useState } from "react";
import { createDownloadUrl } from "@/features/member/actions";
import { calendarFilename, calendarHref } from "@/features/member/utils/calendar";

const styles = {
  /** Solid button, e.g. "Download". */
  primary:
    "rounded-lg bg-primary px-4 py-[9px] text-[13px] font-semibold text-white hover:bg-primary/90",
  /** Outlined button, e.g. "Open link". */
  outline:
    "rounded-lg border border-primary bg-surface px-4 py-[9px] text-[13px] font-semibold text-accent hover:bg-accent-soft",
  /** Inline text action, e.g. "Open meeting link →". */
  text: "text-left text-[11px] font-medium text-accent hover:underline",
  /** Inline text action at the size used in the Coming up list. */
  textLarge: "text-left text-xs font-semibold text-accent hover:underline",
} as const;

export type ActionStyle = keyof typeof styles;

/** Opens an external link in a new tab without leaking the opener. */
export function ExternalLink({
  href,
  style,
  children,
}: {
  href: string;
  style: ActionStyle;
  children: React.ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${styles[style]} whitespace-nowrap`}>
      {children}
    </a>
  );
}

/** Downloads a file: the signed link is created on click and expires after a few minutes. */
export function FileDownload({
  projectId,
  fileId,
  style,
  children,
}: {
  projectId: string;
  fileId: string;
  style: ActionStyle;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const result = await createDownloadUrl(projectId, fileId);
      if (result.ok) window.location.assign(result.url);
      else setError(result.message);
    } catch {
      setError("The download could not be started. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className={`whitespace-nowrap disabled:opacity-60 ${styles[style]}`}
      >
        {busy ? "Preparing…" : children}
      </button>
      {error && (
        <span role="alert" className="text-[11px] text-danger-text">
          {error}
        </span>
      )}
    </span>
  );
}

/** Downloads a one-hour .ics event. */
export function AddToCalendar({
  title,
  startIso,
  location,
  style,
  children,
}: {
  title: string;
  startIso: string;
  location?: string | null;
  style: ActionStyle;
  children: React.ReactNode;
}) {
  return (
    <a
      href={calendarHref(title, startIso, location)}
      download={calendarFilename(title)}
      className={`${styles[style]} whitespace-nowrap`}
    >
      {children}
    </a>
  );
}
