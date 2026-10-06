import { Button } from "@/shared/components/Button";
import { Pill } from "@/shared/components/Pill";
import type { AuditEvent } from "@/features/audit-log/models/audit-event";
import { actionTone, formatWhen, humanize } from "@/features/audit-log/utils/format";

export function AuditTable({
  events,
  onSelect,
}: {
  events: AuditEvent[];
  onSelect: (event: AuditEvent) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-[10px] border border-line bg-surface py-1.5">
      <table className="w-full min-w-[820px] border-collapse text-left">
        <thead>
          <tr className="text-[11px] font-bold text-muted">
            <th scope="col" className="w-[190px] px-4 py-2.5 font-bold">WHEN (ICT)</th>
            <th scope="col" className="py-2.5 pr-3 font-bold">ACTOR</th>
            <th scope="col" className="w-[230px] py-2.5 pr-3 font-bold">ACTION</th>
            <th scope="col" className="w-[150px] py-2.5 pr-3 font-bold">ENTITY</th>
            <th scope="col" className="w-[100px] py-2.5 pr-4 font-bold">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="border-t border-line/60">
              <td className="px-4 py-3 text-[13px] text-ink">{formatWhen(event.occurredAt)}</td>
              <td className="py-3 pr-3">
                {event.actor ? (
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-ink">
                      {event.actor.fullName ?? event.actor.email ?? "Unknown user"}
                    </span>
                    {event.actor.fullName && event.actor.email && (
                      <span className="text-xs text-muted">{event.actor.email}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-[13px] text-muted">System</span>
                )}
              </td>
              <td className="py-3 pr-3">
                <Pill tone={actionTone(event.action)} size="sm">
                  {humanize(event.action)}
                </Pill>
              </td>
              <td className="py-3 pr-3 text-[13px] text-ink">{humanize(event.entityType)}</td>
              <td className="py-3 pr-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelect(event)}
                  aria-label={`View details of ${humanize(event.action)} at ${formatWhen(event.occurredAt)}`}
                >
                  Details
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
