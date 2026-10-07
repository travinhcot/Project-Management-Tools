import { Button } from "@/shared/components/Button";
import { Pill, type PillTone } from "@/shared/components/Pill";
import type { MeetingEmailProject } from "@/features/meeting-emails/models/meeting-email";
import {
  displayUrl,
  getSendStatus,
  type SendStatus,
} from "@/features/meeting-emails/utils/send-status";
import { formatGmt7 } from "@/features/projects/utils/format";

const TYPE_LABEL = { software: "Software", hardware: "Hardware", research: "Research" } as const;

function describe(status: SendStatus): { tone: PillTone; label: string } {
  switch (status.key) {
    case "ready":
      return { tone: "success", label: "Ready" };
    case "scheduled":
      return { tone: "accent", label: "Scheduled" };
    case "sending":
      return { tone: "accent", label: "Sending…" };
    case "sent":
      return { tone: "success", label: `Sent · ${status.sent}/${status.total}` };
    case "partial":
      return {
        tone: "warn",
        label: `${status.sent}/${status.total} sent · ${status.failed} need attention`,
      };
    case "failed":
      return { tone: "danger", label: "Failed" };
    case "link-missing":
      return { tone: "amber", label: "Link missing" };
  }
}

export function MeetingEmailRow({
  project,
  selected,
  busy,
  onSelect,
  onSend,
  onSchedule,
  onSendScheduledNow,
  onCancel,
  onViewDelivery,
  onAddLink,
}: {
  project: MeetingEmailProject;
  selected: boolean;
  /** A write for this project is in flight. */
  busy: boolean;
  onSelect: () => void;
  onSend: () => void;
  onSchedule: () => void;
  onSendScheduledNow: () => void;
  onCancel: () => void;
  onViewDelivery: () => void;
  onAddLink: () => void;
}) {
  const status = getSendStatus(project);
  const pill = describe(status);
  const count = status.total;
  const recipients = `${count} ${count === 1 ? "recipient" : "recipients"}`;
  const kickoff = project.kickoff;

  const note =
    status.key === "link-missing"
      ? "Add a URL before sending"
      : status.key === "ready"
        ? kickoff?.state === "cancelled"
          ? "Previous send was cancelled"
          : "Sends to active assigned members"
        : status.key === "scheduled"
          ? kickoff?.scheduledAt
            ? `Scheduled for ${formatGmt7(kickoff.scheduledAt)}`
            : "Scheduled"
          : status.key === "sending"
            ? `Sending to ${recipients}…`
            : kickoff?.scheduledAt
              ? `Sent ${formatGmt7(kickoff.scheduledAt)}`
              : "";

  return (
    <article
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
      className={`flex cursor-pointer flex-wrap items-start gap-[18px] rounded-[10px] border bg-surface p-[18px] ${
        selected ? "border-primary ring-2 ring-primary/20" : "border-line"
      }`}
    >
      <div className="flex min-w-[240px] flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="text-[17px] font-semibold text-ink">
            <button
              type="button"
              onClick={onSelect}
              aria-label={`Preview email for ${project.name}`}
              className="text-left hover:underline"
            >
              {project.name}
            </button>
          </h3>
          <Pill tone={pill.tone} size="sm">
            {pill.label}
          </Pill>
        </div>
        <p className="whitespace-pre text-xs font-medium text-muted">
          {`${TYPE_LABEL[project.type]}  ·  ${project.memberCount} assigned ${project.memberCount === 1 ? "member" : "members"}`}
        </p>
        <p className="text-[10px] font-bold text-muted">
          {project.usesSharedLink ? "FIRST MEETING URL · SEMESTER LINK" : "FIRST MEETING URL"}
        </p>
        {project.effectiveMeetingUrl ? (
          <a
            href={project.effectiveMeetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="break-all text-[13px] font-medium text-accent hover:underline"
          >
            {displayUrl(project.effectiveMeetingUrl)}
          </a>
        ) : (
          <p className="text-[13px] font-medium text-amber">
            No meeting link yet. Add a semester link or set one for this project
          </p>
        )}
        <p className="text-[11px] text-muted">{note}</p>
      </div>

      <div
        className="flex w-full flex-col gap-2 sm:w-[170px]"
        onClick={(event) => event.stopPropagation()}
      >
        {status.key === "ready" && (
          <>
            <Button onClick={onSend} disabled={busy} className="h-10 w-full">
              {busy ? "Sending…" : "Send email"}
            </Button>
            <Button
              variant="link"
              onClick={onSchedule}
              disabled={busy}
              className="h-10 w-full"
            >
              Schedule
            </Button>
          </>
        )}
        {status.key === "scheduled" && (
          <>
            <Button onClick={onSendScheduledNow} disabled={busy} className="h-10 w-full">
              Send now
            </Button>
            <Button variant="link" onClick={onSchedule} disabled={busy} className="h-10 w-full">
              Reschedule
            </Button>
            <Button variant="link" onClick={onCancel} disabled={busy} className="h-10 w-full">
              Cancel send
            </Button>
          </>
        )}
        {status.key === "sending" && (
          <Button disabled className="h-10 w-full">
            Sending…
          </Button>
        )}
        {(status.key === "sent" ||
          status.key === "partial" ||
          status.key === "failed") && (
          <Button variant="link" onClick={onViewDelivery} className="h-10 w-full">
            View delivery
          </Button>
        )}
        {status.key === "link-missing" && (
          <Button variant="link" onClick={onAddLink} className="h-10 w-full">
            Add meeting link
          </Button>
        )}
        {project.usesSharedLink && (status.key === "ready" || status.key === "scheduled") && (
          <Button variant="ghost" onClick={onAddLink} disabled={busy} className="h-9 w-full text-xs">
            Use own link
          </Button>
        )}
      </div>
    </article>
  );
}
