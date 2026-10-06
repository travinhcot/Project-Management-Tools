import { Button } from "@/shared/components/Button";
import type { Semester, SwitchImpact } from "@/features/semesters/models/semester";

function Stat({ value, label, tone }: { value: number | null; label: string; tone: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg bg-surface px-3 py-2.5">
      <p className={`text-xl font-bold ${tone}`}>{value ?? "…"}</p>
      <p className="text-[11px] font-medium text-muted">{label}</p>
    </div>
  );
}

/** Confirmation for activating a semester (FR-SEM-02): shows who gains and loses access. */
export function SwitchImpactCard({
  target,
  current,
  impact,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  target: Semester;
  current: Semester | undefined;
  /** null while the impact is still being loaded from the backend. */
  impact: SwitchImpact | null;
  /** The switch itself is being saved. */
  pending: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <section
      aria-label={`Make ${target.name} the current semester`}
      aria-busy={impact === null}
      className="flex flex-col gap-3 rounded-[10px] border border-warn-line bg-warn-soft p-[18px]"
    >
      <h2 className="text-[15px] font-bold text-ink">
        Make {target.name} the current semester?
      </h2>
      <p className="text-xs text-muted">
        Members only keep access through the current semester&apos;s roster.
        {current && ` ${current.name} will no longer be current.`}
      </p>
      <div className="flex gap-2.5">
        <Stat value={impact?.losing ?? null} label="lose access" tone="text-danger" />
        <Stat value={impact?.gaining ?? null} label="gain access" tone="text-success" />
        <Stat value={impact?.carryOver ?? null} label="carry over" tone="text-ink" />
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2.5">
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={pending || impact === null}>
          {pending ? "Saving…" : "Set as current"}
        </Button>
      </div>
    </section>
  );
}
