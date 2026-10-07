import { Button } from "@/shared/components/Button";
import { Pill, type PillTone } from "@/shared/components/Pill";
import type {
  DemoCampaign,
  MeetingEmailProject,
  SemesterEmails,
} from "@/features/meeting-emails/models/meeting-email";
import { displayUrl, getSendStatus } from "@/features/meeting-emails/utils/send-status";
import { formatGmt7 } from "@/features/projects/utils/format";

function LinkValue({ url, empty }: { url: string | null; empty: string }) {
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all text-[13px] font-medium text-accent hover:underline"
    >
      {displayUrl(url)}
    </a>
  ) : (
    <p className="text-[13px] font-medium text-amber">{empty}</p>
  );
}

function demoStatus(demo: DemoCampaign | null): { tone: PillTone; label: string; note: string } {
  if (!demo) {
    return { tone: "neutral", label: "Not scheduled", note: "No demo email has been set up yet." };
  }
  switch (demo.state) {
    case "scheduled":
      return {
        tone: "accent",
        label: "Scheduled",
        note: demo.scheduledAt ? `Sends ${formatGmt7(demo.scheduledAt)}` : "Scheduled",
      };
    case "processing":
      return { tone: "accent", label: "Sending…", note: "Sending to the roster…" };
    case "completed":
      return {
        tone: "success",
        label: `Sent · ${demo.counts.sent}`,
        note: demo.scheduledAt ? `Sent ${formatGmt7(demo.scheduledAt)}` : "Sent",
      };
    case "completed_with_failures":
      return {
        tone: "warn",
        label: `${demo.counts.sent} sent · ${demo.counts.failed + demo.counts.unknown} need attention`,
        note: "Some deliveries failed.",
      };
    case "cancelled":
      return { tone: "neutral", label: "Cancelled", note: "This send was cancelled." };
  }
}

/**
 * The two semester-wide emails: the kick-start meeting (one link and one date for every project)
 * and the demo registration email (one link, its own date). A single button edits both links.
 */
export function SemesterEmailsCard({
  links,
  projects,
  busy,
  onEditLinks,
  onScheduleKickoff,
  onScheduleDemo,
  onSendDemoNow,
  onCancelDemo,
}: {
  links: SemesterEmails;
  projects: MeetingEmailProject[];
  busy: boolean;
  onEditLinks: () => void;
  onScheduleKickoff: () => void;
  onScheduleDemo: () => void;
  onSendDemoNow: () => void;
  onCancelDemo: () => void;
}) {
  const statuses = projects.map((project) => getSendStatus(project));
  const scheduled = projects.filter((_, index) => statuses[index].key === "scheduled");
  const scheduledDates = [
    ...new Set(scheduled.map((project) => project.kickoff?.scheduledAt).filter(Boolean)),
  ] as string[];
  const ready = statuses.filter((status) => status.key === "ready").length;
  const sent = statuses.filter((status) =>
    ["sent", "partial", "failed", "sending"].includes(status.key),
  ).length;
  const canScheduleKickoff = scheduled.length + ready > 0;

  const demo = demoStatus(links.demo);
  const demoActive = links.demo?.state === "scheduled";
  const demoLocked =
    links.demo !== null &&
    ["processing", "completed", "completed_with_failures"].includes(links.demo.state);

  return (
    <section
      aria-label="Semester emails"
      className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[19px] font-semibold text-ink">Semester emails</h2>
          <p className="text-xs text-muted">
            Links and send dates that apply to the whole semester.
          </p>
        </div>
        <Button variant="link" onClick={onEditLinks} disabled={busy}>
          {links.kickoffMeetingUrl || links.demoRegistrationUrl ? "Edit links" : "Add links"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-lg bg-chrome p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[15px] font-semibold text-ink">Kick-start meeting</h3>
            {scheduled.length > 0 ? (
              <Pill tone="accent" size="sm">
                {scheduled.length} scheduled
              </Pill>
            ) : sent > 0 ? (
              <Pill tone="success" size="sm">
                {sent} sent
              </Pill>
            ) : null}
          </div>
          <p className="text-[10px] font-bold text-muted">MEETING LINK</p>
          <LinkValue url={links.kickoffMeetingUrl} empty="No shared link yet" />
          <p className="text-[11px] text-muted">
            {scheduledDates.length === 1
              ? `Scheduled for ${formatGmt7(scheduledDates[0])}`
              : scheduledDates.length > 1
                ? "Projects have different send dates"
                : ready > 0
                  ? `${ready} ${ready === 1 ? "project" : "projects"} ready to schedule`
                  : "Each project can still use its own link."}
          </p>
          <div className="mt-1">
            <Button
              variant="link"
              onClick={onScheduleKickoff}
              disabled={busy || !canScheduleKickoff}
            >
              {scheduled.length > 0 ? "Change date for all" : "Schedule all projects"}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg bg-chrome p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[15px] font-semibold text-ink">Demo registration</h3>
            <Pill tone={demo.tone} size="sm">
              {demo.label}
            </Pill>
          </div>
          <p className="text-[10px] font-bold text-muted">REGISTRATION LINK</p>
          <LinkValue url={links.demoRegistrationUrl} empty="No demo link yet" />
          <p className="text-[11px] text-muted">
            {links.demoRegistrationUrl ? demo.note : "Add the demo link before scheduling."}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {!demoLocked && (
              <Button
                variant="link"
                onClick={onScheduleDemo}
                disabled={busy || !links.demoRegistrationUrl}
              >
                {demoActive ? "Reschedule" : "Schedule"}
              </Button>
            )}
            {!demoLocked && !demoActive && (
              <Button
                variant="link"
                onClick={onSendDemoNow}
                disabled={busy || !links.demoRegistrationUrl}
              >
                Send now
              </Button>
            )}
            {demoActive && (
              <Button variant="link" onClick={onCancelDemo} disabled={busy}>
                Cancel send
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
