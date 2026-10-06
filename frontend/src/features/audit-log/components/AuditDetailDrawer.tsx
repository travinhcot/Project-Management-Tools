"use client";

import { Drawer } from "@/shared/components/Drawer";
import type { AuditEvent } from "@/features/audit-log/models/audit-event";
import { formatValue, formatWhen, humanize } from "@/features/audit-log/utils/format";

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="break-all text-[13px] text-ink">{value ?? "—"}</dd>
    </div>
  );
}

export function AuditDetailDrawer({ event, onClose }: { event: AuditEvent; onClose: () => void }) {
  const extra = Object.entries(event.metadata).filter(([key]) => key !== "before" && key !== "after");
  return (
    <Drawer title={humanize(event.action)} subtitle={formatWhen(event.occurredAt)} onClose={onClose}>
      <dl className="flex flex-col gap-3">
        <Row
          label="Actor"
          value={
            event.actor
              ? [event.actor.fullName, event.actor.email].filter(Boolean).join(" · ") || event.actor.id
              : "System"
          }
        />
        <Row label="Action code" value={event.action} />
        <Row label="Entity type" value={event.entityType} />
        <Row label="Entity id" value={event.entityId} />
        <Row label="Semester id" value={event.semesterId} />
        <Row label="Request id" value={event.requestId} />
      </dl>

      {event.diff.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-bold text-muted">CHANGES</h3>
          <ul className="flex flex-col gap-2">
            {event.diff.map((change) => (
              <li key={change.field} className="rounded-lg border border-line p-3 text-[13px]">
                <p className="font-semibold text-ink">{change.field}</p>
                <p className="break-all text-muted line-through">{formatValue(change.before)}</p>
                <p className="break-all text-ink">{formatValue(change.after)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {extra.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-bold text-muted">DETAILS</h3>
          <dl className="flex flex-col gap-2">
            {extra.map(([key, value]) => (
              <Row key={key} label={key} value={formatValue(value)} />
            ))}
          </dl>
        </section>
      )}
    </Drawer>
  );
}
