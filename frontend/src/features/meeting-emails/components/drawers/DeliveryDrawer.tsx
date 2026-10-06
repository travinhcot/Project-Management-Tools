"use client";

import { Button } from "@/shared/components/Button";
import { Drawer } from "@/shared/components/Drawer";
import { Pill, type PillTone } from "@/shared/components/Pill";
import type {
  DeliveryState,
  MeetingEmailProject,
} from "@/features/meeting-emails/models/meeting-email";
import { getSendStatus } from "@/features/meeting-emails/utils/send-status";
import type { SemesterSummary } from "@/features/projects/models/project";
import { formatGmt7 } from "@/features/projects/utils/format";

const STATE_PILL: Record<DeliveryState, { tone: PillTone; label: string }> = {
  sent: { tone: "success", label: "Sent" },
  failed: { tone: "danger", label: "Failed" },
  sending: { tone: "accent", label: "Sending" },
  pending: { tone: "neutral", label: "Pending" },
};

/** Per-recipient delivery report (FR-EML-04). Retry only touches failed rows. */
export function DeliveryDrawer({
  project,
  semester,
  onClose,
  onRetryFailed,
}: {
  project: MeetingEmailProject;
  semester: SemesterSummary;
  onClose: () => void;
  onRetryFailed: () => void;
}) {
  const status = getSendStatus(project);
  const recipients = new Map(project.recipients.map((r) => [r.id, r]));

  return (
    <Drawer
      title="Delivery report"
      subtitle={`${project.name}  ·  ${semester.label}`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-0.5 rounded-[10px] bg-chrome p-3">
        <span className="text-[11px] font-semibold text-muted">Result</span>
        <span className="text-[13px] font-medium text-ink">
          {status.sent} of {status.total} sent
          {status.failed > 0 && ` · ${status.failed} need attention`}
        </span>
        {project.lastSentAt && (
          <span className="text-xs text-muted">
            Last attempt {formatGmt7(project.lastSentAt)}
          </span>
        )}
      </div>

      <ul className="flex flex-col divide-y divide-line/60 rounded-[10px] border border-line">
        {project.deliveries.map((delivery) => {
          const recipient = recipients.get(delivery.recipientId);
          const pill = STATE_PILL[delivery.state];
          return (
            <li key={delivery.recipientId} className="flex flex-col gap-1 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-ink">
                  {recipient?.fullName ?? "Unknown member"}
                </span>
                <Pill tone={pill.tone} size="sm">
                  {pill.label}
                </Pill>
              </div>
              <span className="break-all text-xs text-muted">
                {recipient?.email}
              </span>
              <span className="text-[11px] text-muted">
                {delivery.attempts} {delivery.attempts === 1 ? "attempt" : "attempts"}
                {delivery.error && ` · ${delivery.error}`}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="rounded-[10px] bg-accent-soft p-3 text-xs text-info-text">
        Retry only re-sends to failed recipients. Members who already received
        the email are not included.
      </p>

      <div className="flex gap-2.5">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button disabled={status.failed === 0} onClick={onRetryFailed}>
          Retry {status.failed || ""} failed
        </Button>
      </div>
    </Drawer>
  );
}
