"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SemesterBadge } from "@/shared/components/SemesterBadge";
import {
  cancelCampaign,
  removeMeetingLink,
  rescheduleCampaign,
  resendCampaign,
  resolveDelivery,
  retryFailedDeliveries,
  saveMeetingLink,
  scheduleKickoff,
  sendCampaignNow,
  sendKickoffNow,
  type ActionResult,
} from "@/features/meeting-emails/actions";
import { DeliveryDrawer } from "@/features/meeting-emails/components/drawers/DeliveryDrawer";
import { ScheduleDrawer } from "@/features/meeting-emails/components/drawers/ScheduleDrawer";
import { EmailPreview } from "@/features/meeting-emails/components/EmailPreview";
import { MeetingEmailRow } from "@/features/meeting-emails/components/MeetingEmailRow";
import type { MeetingEmailProject } from "@/features/meeting-emails/models/meeting-email";
import { getSendStatus } from "@/features/meeting-emails/utils/send-status";
import { MeetingLinkDrawer } from "@/features/projects/components/drawers/MeetingLinkDrawer";
import type { SemesterSummary } from "@/features/projects/models/project";

type DrawerState =
  | { kind: "link"; id: string }
  | { kind: "delivery"; id: string }
  | { kind: "schedule"; id: string }
  | null;

/** While a campaign is queued or sending, the page re-reads the backend this often. */
const REFRESH_MS = 5000;

export function MeetingEmailsPage({
  semester,
  projects,
}: {
  semester: SemesterSummary | null;
  projects: MeetingEmailProject[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(projects[0]?.id ?? "");
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  const inFlight = projects.some((project) => {
    const key = getSendStatus(project).key;
    return key === "sending" || key === "scheduled";
  });
  useEffect(() => {
    if (!inFlight) return;
    const timer = window.setInterval(() => router.refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [inFlight, router]);

  const selected = projects.find((project) => project.id === selectedId) ?? projects[0];
  const drawerProject = drawer && projects.find((project) => project.id === drawer.id);
  const errorMessage = (id: string) => (error?.id === id ? error.message : undefined);

  /** Runs a write for a project; closes the drawer on success, shows the backend message otherwise. */
  async function perform(id: string, work: () => Promise<ActionResult>) {
    setBusyId(id);
    setError(null);
    const result = await work();
    setBusyId(null);
    if (result.ok) {
      setDrawer(null);
      router.refresh();
    } else {
      setError({ id, message: result.message });
    }
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <p className="whitespace-pre text-[13px] font-medium text-muted">
        {"Workspace  /  Project Management  /  Meeting emails"}
      </p>

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[30px] font-bold text-ink">Meeting emails</h1>
          <p className="text-sm text-muted">
            Send each project’s first-meeting link to its assigned members.
          </p>
        </div>
        {semester && <SemesterBadge name={semester.name} active={semester.active} />}
      </div>

      <div className="flex flex-col gap-[7px] rounded-[10px] bg-accent-soft p-[18px]">
        <p className="text-[17px] font-semibold text-ink">
          Send meeting links in one step
        </p>
        <p className="text-[13px] text-muted">
          Save a meeting URL for the project, then press Send email, or schedule it
          for a later date, to notify its active assigned members. Delivery results
          appear here.
        </p>
      </div>

      {selected && errorMessage(selected.id) && !drawer && (
        <p role="alert" className="rounded-[10px] bg-danger-soft p-3 text-[13px] font-medium text-danger-text">
          {errorMessage(selected.id)}
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_414px]">
        <section aria-label="Project meeting links" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[19px] font-semibold text-ink">
              Project meeting links
            </h2>
            <p className="text-xs font-medium text-muted" aria-live="polite">
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </p>
          </div>

          {projects.length > 0 ? (
            projects.map((project) => (
              <MeetingEmailRow
                key={project.id}
                project={project}
                selected={project.id === selected?.id}
                busy={busyId === project.id}
                onSelect={() => setSelectedId(project.id)}
                onSend={() => {
                  setSelectedId(project.id);
                  void perform(project.id, () => sendKickoffNow(project.id));
                }}
                onSchedule={() => {
                  setSelectedId(project.id);
                  setError(null);
                  setDrawer({ kind: "schedule", id: project.id });
                }}
                onSendScheduledNow={() =>
                  project.kickoff &&
                  void perform(project.id, () => sendCampaignNow(project.kickoff!.id))
                }
                onCancel={() =>
                  project.kickoff &&
                  void perform(project.id, () => cancelCampaign(project.kickoff!.id))
                }
                onViewDelivery={() => {
                  setError(null);
                  setDrawer({ kind: "delivery", id: project.id });
                }}
                onAddLink={() => {
                  setError(null);
                  setDrawer({ kind: "link", id: project.id });
                }}
              />
            ))
          ) : (
            <div className="rounded-[10px] border border-line bg-surface p-8 text-center">
              <p className="text-[15px] font-semibold text-ink">No projects yet</p>
              <p className="mt-1 text-xs text-muted">
                {semester
                  ? `Projects in ${semester.name} appear here once they exist.`
                  : "Set a current semester to see its projects here."}
              </p>
            </div>
          )}
        </section>

        {selected && <EmailPreview project={selected} />}
      </div>

      <p className="text-xs text-muted">
        Already-sent members are not included in a routine retry. A deliberate
        resend is a separate action.
      </p>

      {semester && drawer?.kind === "link" && drawerProject && (
        <MeetingLinkDrawer
          key={drawerProject.id}
          project={drawerProject}
          semester={semester}
          busy={busyId === drawerProject.id}
          error={errorMessage(drawerProject.id)}
          onClose={() => setDrawer(null)}
          onSave={(link) =>
            void perform(drawerProject.id, () => saveMeetingLink(drawerProject.id, link))
          }
          onRemove={() =>
            void perform(drawerProject.id, () => removeMeetingLink(drawerProject.id))
          }
        />
      )}
      {semester && drawer?.kind === "schedule" && drawerProject && (
        <ScheduleDrawer
          key={drawerProject.id}
          projectName={drawerProject.name}
          semester={semester}
          rescheduling={drawerProject.kickoff?.state === "scheduled"}
          busy={busyId === drawerProject.id}
          error={errorMessage(drawerProject.id)}
          onClose={() => setDrawer(null)}
          onSchedule={(date) =>
            void perform(drawerProject.id, () =>
              drawerProject.kickoff?.state === "scheduled"
                ? rescheduleCampaign(drawerProject.kickoff.id, date)
                : scheduleKickoff(drawerProject.id, date),
            )
          }
        />
      )}
      {semester && drawer?.kind === "delivery" && drawerProject?.kickoff && (
        <DeliveryDrawer
          key={drawerProject.id}
          project={drawerProject}
          semester={semester}
          busy={busyId === drawerProject.id}
          error={errorMessage(drawerProject.id)}
          refreshKey={JSON.stringify(drawerProject.kickoff.counts)}
          onClose={() => setDrawer(null)}
          onRetryFailed={() =>
            void perform(drawerProject.id, () =>
              retryFailedDeliveries(drawerProject.kickoff!.id),
            )
          }
          onResend={() =>
            void perform(drawerProject.id, () => resendCampaign(drawerProject.kickoff!.id))
          }
          onResolve={(deliveryId, action) =>
            void perform(drawerProject.id, () =>
              resolveDelivery(drawerProject.kickoff!.id, deliveryId, action),
            )
          }
        />
      )}
    </div>
  );
}
