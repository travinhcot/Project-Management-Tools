"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SemesterSwitcher,
  type SemesterOption,
} from "@/shared/components/SemesterSwitcher";
import {
  cancelCampaign,
  saveSemesterLinks,
  scheduleDemo,
  scheduleKickoffForAll,
  scheduleProjectResourcesForAll,
  sendDemoNow,
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
import { SemesterEmailsCard } from "@/features/meeting-emails/components/SemesterEmailsCard";
import { SemesterLinksDrawer } from "@/features/meeting-emails/components/drawers/SemesterLinksDrawer";
import { DeliveryDrawer } from "@/features/meeting-emails/components/drawers/DeliveryDrawer";
import { ScheduleDrawer } from "@/features/meeting-emails/components/drawers/ScheduleDrawer";
import { EmailPreview } from "@/features/meeting-emails/components/EmailPreview";
import { MeetingEmailRow } from "@/features/meeting-emails/components/MeetingEmailRow";
import type {
  MeetingEmailProject,
  SemesterEmails,
} from "@/features/meeting-emails/models/meeting-email";
import { getSendStatus } from "@/features/meeting-emails/utils/send-status";
import { ResourceLinkDrawer } from "@/features/projects/components/drawers/ResourceLinkDrawer";
import type { SemesterSummary } from "@/features/projects/models/project";

type DrawerState =
  | { kind: "link"; id: string }
  | { kind: "delivery"; id: string }
  | { kind: "schedule"; id: string }
  | { kind: "semester-links" }
  | { kind: "kickoff-all" }
  | { kind: "demo" }
  | { kind: "resources-all" }
  | null;

/** Busy/error key for writes that belong to the semester rather than to one project. */
const SEMESTER_KEY = "semester";

/** While a campaign is queued or sending, the page re-reads the backend this often. */
const REFRESH_MS = 5000;

export function MeetingEmailsPage({
  semester,
  projects,
  links,
  semesters,
}: {
  semester: SemesterSummary | null;
  projects: MeetingEmailProject[];
  links: SemesterEmails | null;
  semesters: SemesterOption[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(projects[0]?.id ?? "");
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(
    null,
  );

  const inFlight = projects.some((project) => {
    const key = getSendStatus(project).key;
    return key === "sending" || key === "scheduled";
  });
  useEffect(() => {
    if (!inFlight) return;
    const timer = window.setInterval(() => router.refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [inFlight, router]);

  const selected =
    projects.find((project) => project.id === selectedId) ?? projects[0];
  const drawerProject =
    drawer && "id" in drawer
      ? projects.find((project) => project.id === drawer.id)
      : undefined;
  const errorMessage = (id: string) =>
    error?.id === id ? error.message : undefined;

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
      <p className="whitespace-pre-wrap break-words text-[13px] font-medium text-muted">
        {"Workspace  /  Project Management  /  Meeting emails"}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold sm:text-[30px] text-ink">
            Meeting emails
          </h1>
          <p className="text-sm text-muted">
            Set the semester’s kick-start and demo links, then choose when each
            email goes out.
          </p>
        </div>
        {semester && (
          <SemesterSwitcher
            options={semesters}
            selectedId={semester.id}
            basePath="/meeting-emails"
          />
        )}
      </div>

      {links && (
        <SemesterEmailsCard
          links={links}
          projects={projects}
          busy={busyId === SEMESTER_KEY}
          onEditLinks={() => {
            setError(null);
            setDrawer({ kind: "semester-links" });
          }}
          onScheduleKickoff={() => {
            setError(null);
            setDrawer({ kind: "kickoff-all" });
          }}
          onScheduleDemo={() => {
            setError(null);
            setDrawer({ kind: "demo" });
          }}
          onScheduleResources={() => {
            setError(null);
            setDrawer({ kind: "resources-all" });
          }}
          onSendDemoNow={() =>
            void perform(SEMESTER_KEY, () => sendDemoNow(links.semesterId))
          }
          onCancelDemo={() =>
            links.demo &&
            void perform(SEMESTER_KEY, () => cancelCampaign(links.demo!.id))
          }
        />
      )}
      {!drawer && errorMessage(SEMESTER_KEY) && (
        <p
          role="alert"
          className="rounded-[10px] bg-danger-soft p-3 text-[13px] font-medium text-danger-text"
        >
          {errorMessage(SEMESTER_KEY)}
        </p>
      )}

      {selected && errorMessage(selected.id) && !drawer && (
        <p
          role="alert"
          className="rounded-[10px] bg-danger-soft p-3 text-[13px] font-medium text-danger-text"
        >
          {errorMessage(selected.id)}
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_414px]">
        <section
          aria-label="Project meeting links"
          className="flex flex-col gap-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
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
                  void perform(project.id, () =>
                    sendCampaignNow(project.kickoff!.id),
                  )
                }
                onCancel={() =>
                  project.kickoff &&
                  void perform(project.id, () =>
                    cancelCampaign(project.kickoff!.id),
                  )
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
            <div className="rounded-2xl bg-surface shadow-card p-8 text-center">
              <p className="text-[15px] font-semibold text-ink">
                No projects yet
              </p>
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

      {semester && links && drawer?.kind === "semester-links" && (
        <SemesterLinksDrawer
          semester={semester}
          links={links}
          busy={busyId === SEMESTER_KEY}
          error={errorMessage(SEMESTER_KEY)}
          onClose={() => setDrawer(null)}
          onSave={(next) =>
            void perform(SEMESTER_KEY, () =>
              saveSemesterLinks(links.semesterId, next),
            )
          }
        />
      )}
      {semester && links && drawer?.kind === "kickoff-all" && (
        <ScheduleDrawer
          projectName="All projects"
          semester={semester}
          rescheduling={false}
          title="Kick-start date"
          note="Every project that is ready, or already scheduled, will send its kick-start email at 09:00 GMT+7 on this date. Projects already sending or sent are not changed."
          busy={busyId === SEMESTER_KEY}
          error={errorMessage(SEMESTER_KEY)}
          onClose={() => setDrawer(null)}
          onSchedule={(date) =>
            void perform(SEMESTER_KEY, async () => {
              const targets: {
                projectId: string;
                name: string;
                campaignId: string | null;
              }[] = [];
              for (const project of projects) {
                const key = getSendStatus(project).key;
                if (key === "scheduled" && project.kickoff) {
                  targets.push({
                    projectId: project.id,
                    name: project.name,
                    campaignId: project.kickoff.id,
                  });
                } else if (key === "ready") {
                  targets.push({
                    projectId: project.id,
                    name: project.name,
                    campaignId: null,
                  });
                }
              }
              const result = await scheduleKickoffForAll(targets, date);
              if (!result.ok || result.failed.length === 0) return result;
              return {
                ok: false as const,
                code: "PARTIAL",
                message: `${result.done} scheduled. Could not schedule ${result.failed
                  .map((item) => `${item.name} (${item.message})`)
                  .join(", ")}.`,
              };
            })
          }
        />
      )}
      {semester && links && drawer?.kind === "resources-all" && (
        <ScheduleDrawer
          projectName="All projects"
          semester={semester}
          rescheduling={false}
          title="Project resources date"
          note="Every project sends its follow-up email (GitHub repo and video guide) at 09:00 GMT+7 on this date. Projects already sending or sent are not changed."
          busy={busyId === SEMESTER_KEY}
          error={errorMessage(SEMESTER_KEY)}
          onClose={() => setDrawer(null)}
          onSchedule={(date) =>
            void perform(SEMESTER_KEY, async () => {
              const targets: {
                projectId: string;
                name: string;
                campaignId: string | null;
              }[] = [];
              for (const project of projects) {
                const existing = links.projectResources.find(
                  (item) => item.projectId === project.id,
                );
                if (!existing) {
                  targets.push({
                    projectId: project.id,
                    name: project.name,
                    campaignId: null,
                  });
                } else if (existing.state === "scheduled") {
                  targets.push({
                    projectId: project.id,
                    name: project.name,
                    campaignId: existing.id,
                  });
                }
              }
              const result = await scheduleProjectResourcesForAll(
                targets,
                date,
              );
              if (!result.ok || result.failed.length === 0) return result;
              return {
                ok: false as const,
                code: "PARTIAL",
                message: `${result.done} scheduled. Could not schedule ${result.failed
                  .map((item) => `${item.name} (${item.message})`)
                  .join(", ")}.`,
              };
            })
          }
        />
      )}
      {semester && links && drawer?.kind === "demo" && (
        <ScheduleDrawer
          projectName="Demo registration"
          semester={semester}
          rescheduling={links.demo?.state === "scheduled"}
          title={
            links.demo?.state === "scheduled"
              ? "Reschedule demo email"
              : "Schedule demo email"
          }
          note="The demo registration email is sent at 09:00 GMT+7 on this date to everyone on the roster."
          busy={busyId === SEMESTER_KEY}
          error={errorMessage(SEMESTER_KEY)}
          onClose={() => setDrawer(null)}
          onSchedule={(date) =>
            void perform(SEMESTER_KEY, () =>
              links.demo?.state === "scheduled"
                ? rescheduleCampaign(links.demo.id, date)
                : scheduleDemo(links.semesterId, date),
            )
          }
        />
      )}
      {semester && drawer?.kind === "link" && drawerProject && (
        <ResourceLinkDrawer
          key={drawerProject.id}
          slot="FIRST_MEETING"
          project={drawerProject}
          current={
            drawerProject.meetingUrl
              ? {
                  kind: "link",
                  url: drawerProject.meetingUrl,
                  label: drawerProject.meetingLabel,
                }
              : null
          }
          semester={semester}
          busy={busyId === drawerProject.id}
          error={errorMessage(drawerProject.id)}
          onClose={() => setDrawer(null)}
          onSave={(link) =>
            void perform(drawerProject.id, () =>
              saveMeetingLink(drawerProject.id, link),
            )
          }
          onRemove={() =>
            void perform(drawerProject.id, () =>
              removeMeetingLink(drawerProject.id),
            )
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
            void perform(drawerProject.id, () =>
              resendCampaign(drawerProject.kickoff!.id),
            )
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
