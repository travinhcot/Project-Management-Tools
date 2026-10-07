export default function Loading() {
  return (
    <div
      className="flex flex-col gap-[22px]"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="text-[13px] font-medium text-muted">
        {"Workspace  /  Project Management"}
      </p>
      <div className="h-[76px] w-[420px] max-w-full animate-pulse rounded-[10px] bg-chrome" />
      <div className="h-[110px] animate-pulse rounded-[10px] border border-line bg-surface" />
      <div className="h-[260px] animate-pulse rounded-[10px] border border-line bg-surface" />
      <span className="sr-only">Loading overview…</span>
    </div>
  );
}
