export default function Loading() {
  return (
    <div className="flex flex-col gap-[22px]" aria-busy="true" aria-live="polite">
      <p className="text-[13px] font-medium text-muted">
        {"Workspace  /  Project Management  /  Meeting emails"}
      </p>
      <div className="h-[76px] w-[420px] max-w-full animate-pulse rounded-[10px] bg-chrome" />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_414px]">
        <div className="flex flex-col gap-3">
          <div className="h-[140px] animate-pulse rounded-[10px] border border-line bg-surface" />
          <div className="h-[140px] animate-pulse rounded-[10px] border border-line bg-surface" />
        </div>
        <div className="h-[260px] animate-pulse rounded-[10px] border border-line bg-surface" />
      </div>
      <span className="sr-only">Loading meeting emails…</span>
    </div>
  );
}
