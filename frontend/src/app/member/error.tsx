"use client";

import { Button } from "@/shared/components/Button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[10px] border border-danger-line bg-surface p-8">
      <h1 className="text-[17px] font-semibold text-ink">This page could not be loaded</h1>
      <p role="alert" className="text-[13px] text-muted">
        The server may be unavailable. Try again, or sign out and back in.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
