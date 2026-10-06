import type { MeetingEmailProject } from "@/features/meeting-emails/models/meeting-email";
import { displayUrl } from "@/features/meeting-emails/utils/send-status";

/** Mirrors the fixed kick-off template (FR-EML-05); the real render lives in the backend. */
export function EmailPreview({ project }: { project: MeetingEmailProject }) {
  const count = project.recipients.length;

  return (
    <aside
      aria-label="Email preview"
      className="flex flex-col gap-[15px] rounded-[10px] border border-line bg-surface p-[22px]"
    >
      <h2 className="text-[19px] font-semibold text-ink">Email preview</h2>
      <p className="text-xs text-muted">
        The message prepared for {project.name}.
      </p>

      <div className="flex flex-col gap-[9px] rounded-lg bg-chrome p-[13px] text-xs">
        <p className="whitespace-pre font-medium text-muted">
          {`To  ${count} assigned ${count === 1 ? "member" : "members"}`}
        </p>
        <p className="whitespace-pre font-semibold text-ink">
          {`Subject  ${project.name} · first meeting`}
        </p>
      </div>

      <p className="text-[10px] font-bold text-muted">MESSAGE</p>
      <p className="text-[13px] font-medium text-ink">
        Hello {project.name} team,
      </p>
      <p className="text-[13px] text-muted">
        Your first meeting is ready. Use the link below to join at the scheduled
        time.
      </p>

      <div className="flex flex-col gap-2 rounded-lg bg-accent-soft p-3">
        <p className="text-[10px] font-bold text-muted">FIRST MEETING</p>
        {project.meetingUrl ? (
          <p className="break-all text-[13px] font-semibold text-accent">
            {displayUrl(project.meetingUrl)}
          </p>
        ) : (
          <p className="text-[13px] font-semibold text-amber">
            Add a meeting link to complete this message
          </p>
        )}
      </div>

      <p className="text-[13px] font-semibold text-accent">
        Open your project in NCT Hub →
      </p>

      <div className="flex flex-col gap-2 rounded-lg bg-chrome p-3">
        <p className="text-[10px] font-bold text-muted">AFTER PRESSING SEND EMAIL</p>
        <p className="whitespace-pre text-xs font-medium text-ink">
          {`Sending  →  Sent ${count}/${count}  or  Failed`}
        </p>
        <p className="text-[11px] text-muted">
          The delivery report records each recipient and attempt.
        </p>
      </div>
    </aside>
  );
}
