export default function Loading() {
  return (
    <div className="flex flex-col gap-[22px]" aria-busy="true" aria-live="polite">
      <p className="text-[13px] font-medium text-muted">
        {"Workspace  /  Project Management  /  Audit log"}
      </p>
      <div className="h-[76px] w-[420px] max-w-full animate-pulse rounded-[10px] bg-chrome" />
      <div className="h-[320px] animate-pulse rounded-2xl bg-surface shadow-card" />
      <span className="sr-only">Loading audit log…</span>
    </div>
  );
}
