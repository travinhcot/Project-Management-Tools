import Link from "next/link";
import { Pill } from "@/shared/components/Pill";
import type { DashboardWarning } from "@/features/overview/models/dashboard";

export function AttentionCard({ warnings }: { warnings: DashboardWarning[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-[10px] border border-line bg-surface p-5">
      <div className="flex h-7 items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Needs attention</h2>
        <Pill tone="amber">
          {warnings.length} {warnings.length === 1 ? "item" : "items"}
        </Pill>
      </div>
      <p className="text-[13px] text-muted">
        Resolve these before the next project kick-off.
      </p>
      {warnings.map((warning) => (
        <div
          key={warning.id}
          className="flex items-start justify-between gap-3 rounded-lg bg-chrome p-3"
        >
          <div className="flex flex-col gap-0.5">
            <p className="text-[13px] font-semibold text-ink">
              {warning.message}
            </p>
            <p className="text-xs text-muted">{warning.hint}</p>
          </div>
          <Link
            href={warning.link}
            className="whitespace-nowrap text-xs font-semibold text-accent"
          >
            Review →
          </Link>
        </div>
      ))}
    </section>
  );
}
