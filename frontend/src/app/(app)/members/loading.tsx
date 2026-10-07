export default function Loading() {
  return (
    <div className="flex flex-col gap-[22px]" aria-busy="true" aria-live="polite">
      <p className="text-[13px] font-medium text-muted">
        {"Workspace  /  Project Management  /  Members"}
      </p>
      <div className="h-[76px] w-[420px] max-w-full animate-pulse rounded-[10px] bg-chrome" />
      <div className="h-11 animate-pulse rounded-lg bg-chrome" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-[140px] animate-pulse rounded-2xl bg-surface shadow-card" />
        <div className="h-[140px] animate-pulse rounded-2xl bg-surface shadow-card" />
        <div className="h-[140px] animate-pulse rounded-2xl bg-surface shadow-card" />
      </div>
      <span className="sr-only">Loading members…</span>
    </div>
  );
}
