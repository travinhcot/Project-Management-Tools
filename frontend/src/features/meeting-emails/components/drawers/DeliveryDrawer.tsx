"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/components/Button";
import { Drawer } from "@/shared/components/Drawer";
import { Pill, type PillTone } from "@/shared/components/Pill";
import { getDeliveries } from "@/features/meeting-emails/actions";
import type {
  Delivery,
  DeliveryState,
  MeetingEmailProject,
} from "@/features/meeting-emails/models/meeting-email";
import { getSendStatus } from "@/features/meeting-emails/utils/send-status";
import type { SemesterSummary } from "@/features/projects/models/project";
import { formatGmt7 } from "@/features/projects/utils/format";

const STATE_PILL: Record<DeliveryState, { tone: PillTone; label: string }> = {
  sent: { tone: "success", label: "Sent" },
  failed: { tone: "danger", label: "Failed" },
  retrying: { tone: "warn", label: "Retrying" },
  unknown: { tone: "warn", label: "Unconfirmed" },
  sending: { tone: "accent", label: "Sending" },
  pending: { tone: "neutral", label: "Pending" },
  skipped: { tone: "neutral", label: "Skipped" },
};

/** Per-recipient delivery report (FR-EML-04). Retry only touches failed rows. */
export function DeliveryDrawer({
  project,
  semester,
  busy,
  error,
  refreshKey,
  onClose,
  onRetryFailed,
  onResend,
  onResolve,
}: {
  project: MeetingEmailProject;
  semester: SemesterSummary;
  /** A write is in flight. */
  busy: boolean;
  /** Backend message from the last failed write. */
  error?: string;
  /** Changes whenever the campaign data was refreshed, so the report reloads. */
  refreshKey: string;
  onClose: () => void;
  onRetryFailed: () => void;
  onResend: () => void;
  onResolve: (deliveryId: string, action: "MARK_SENT" | "RETRY") => void;
}) {
  const status = getSendStatus(project);
  const campaignId = project.kickoff?.id ?? null;
  const [report, setReport] = useState<{
    key: string;
    deliveries: Delivery[] | null;
    error: string | null;
  } | null>(null);
  const key = `${campaignId}|${refreshKey}`;

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    getDeliveries(campaignId).then((result) => {
      if (cancelled) return;
      setReport(
        result.ok
          ? { key, deliveries: result.deliveries, error: null }
          : { key, deliveries: null, error: result.message },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [campaignId, key]);

  const current = report?.key === key ? report : null;
  const retryable = (current?.deliveries ?? []).filter(
    (d) => d.state === "failed" || d.state === "retrying",
  ).length;

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
        {project.kickoff?.scheduledAt && (
          <span className="text-xs text-muted">
            Sent {formatGmt7(project.kickoff.scheduledAt)}
          </span>
        )}
      </div>

      {current?.error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {current.error}
        </p>
      ) : !current?.deliveries ? (
        <div className="h-24 animate-pulse rounded-[10px] bg-chrome" aria-busy="true" />
      ) : (
        <ul className="flex flex-col divide-y divide-line/60 rounded-[10px] border border-line">
          {current.deliveries.map((delivery) => {
            const pill = STATE_PILL[delivery.state];
            return (
              <li key={delivery.id} className="flex flex-col gap-1 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-ink">
                    {delivery.fullName}
                  </span>
                  <Pill tone={pill.tone} size="sm">
                    {pill.label}
                  </Pill>
                </div>
                <span className="break-all text-xs text-muted">{delivery.email}</span>
                <span className="text-[11px] text-muted">
                  {delivery.attempts} {delivery.attempts === 1 ? "attempt" : "attempts"}
                  {delivery.error && ` · ${delivery.error}`}
                </span>
                {delivery.state === "unknown" && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => onResolve(delivery.id, "MARK_SENT")}
                    >
                      Mark as sent
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => onResolve(delivery.id, "RETRY")}
                    >
                      Send again
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="rounded-[10px] bg-accent-soft p-3 text-xs text-info-text">
        Retry only re-sends to failed recipients. Members who already received
        the email are not included. A resend emails everyone again.
      </p>

      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2.5">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button disabled={busy || retryable === 0} onClick={onRetryFailed}>
          Retry {retryable || ""} failed
        </Button>
        <Button variant="outline" disabled={busy} onClick={onResend}>
          Resend to everyone
        </Button>
      </div>
    </Drawer>
  );
}
