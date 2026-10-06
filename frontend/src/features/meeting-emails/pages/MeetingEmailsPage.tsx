"use client";

import { useEffect, useRef, useState } from "react";
import { SemesterBadge } from "@/shared/components/SemesterBadge";
import { DeliveryDrawer } from "@/features/meeting-emails/components/drawers/DeliveryDrawer";
import { EmailPreview } from "@/features/meeting-emails/components/EmailPreview";
import { MeetingEmailRow } from "@/features/meeting-emails/components/MeetingEmailRow";
import type {
  Delivery,
  MeetingEmailProject,
} from "@/features/meeting-emails/models/meeting-email";
import { MeetingLinkDrawer } from "@/features/projects/components/drawers/MeetingLinkDrawer";
import type { SemesterSummary } from "@/features/projects/models/project";

type DrawerState =
  | { kind: "link"; id: string }
  | { kind: "delivery"; id: string }
  | null;

const SEND_DELAY_MS = 1200;

// Sending is simulated locally (everything succeeds) until the campaign API is wired.
export function MeetingEmailsPage({
  semester,
  initialProjects,
}: {
  semester: SemesterSummary;
  initialProjects: MeetingEmailProject[];
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [selectedId, setSelectedId] = useState(initialProjects[0]?.id ?? "");
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const selected = projects.find((project) => project.id === selectedId);
  const drawerProject =
    drawer && projects.find((project) => project.id === drawer.id);

  function patch(id: string, change: (project: MeetingEmailProject) => MeetingEmailProject) {
    setProjects((current) =>
      current.map((project) => (project.id === id ? change(project) : project)),
    );
  }

  /** Marks the matching deliveries "sending", then settles them as sent after a short delay. */
  function dispatch(id: string, shouldSend: (delivery: Delivery) => boolean) {
    patch(id, (project) => ({
      ...project,
      deliveries: project.recipients.map((recipient) => {
        const existing = project.deliveries.find((d) => d.recipientId === recipient.id);
        if (existing && !shouldSend(existing)) return existing;
        return {
          recipientId: recipient.id,
          state: "sending",
          attempts: existing?.attempts ?? 0,
          lastAttemptAt: existing?.lastAttemptAt ?? null,
          error: null,
        };
      }),
    }));

    timers.current.push(
      window.setTimeout(() => {
        const now = new Date().toISOString();
        patch(id, (project) => ({
          ...project,
          lastSentAt: now,
          deliveries: project.deliveries.map((delivery) =>
            delivery.state === "sending"
              ? {
                  ...delivery,
                  state: "sent",
                  attempts: delivery.attempts + 1,
                  lastAttemptAt: now,
                }
              : delivery,
          ),
        }));
      }, SEND_DELAY_MS),
    );
  }

  function saveLink(id: string, link: { url: string; label: string | null } | null) {
    patch(id, (project) => ({
      ...project,
      meetingUrl: link?.url ?? null,
      meetingLabel: link?.label ?? null,
    }));
    setSelectedId(id);
    setDrawer(null);
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
        <SemesterBadge name={semester.name} active={semester.active} />
      </div>

      <div className="flex flex-col gap-[7px] rounded-[10px] bg-accent-soft p-[18px]">
        <p className="text-[17px] font-semibold text-ink">
          Send meeting links in one step
        </p>
        <p className="text-[13px] text-muted">
          Save a meeting URL for the project, then press Send email to notify its
          active assigned members. Delivery results appear here.
        </p>
      </div>

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
                selected={project.id === selectedId}
                onSelect={() => setSelectedId(project.id)}
                onSend={() => {
                  setSelectedId(project.id);
                  dispatch(project.id, () => true);
                }}
                onViewDelivery={() => setDrawer({ kind: "delivery", id: project.id })}
                onAddLink={() => setDrawer({ kind: "link", id: project.id })}
              />
            ))
          ) : (
            <div className="rounded-[10px] border border-line bg-surface p-8 text-center">
              <p className="text-[15px] font-semibold text-ink">No projects yet</p>
              <p className="mt-1 text-xs text-muted">
                Projects in {semester.name} appear here once they exist.
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

      {drawer?.kind === "link" && drawerProject && (
        <MeetingLinkDrawer
          key={drawerProject.id}
          project={drawerProject}
          semester={semester}
          onClose={() => setDrawer(null)}
          onSave={(link) => saveLink(drawerProject.id, link)}
          onRemove={() => saveLink(drawerProject.id, null)}
        />
      )}
      {drawer?.kind === "delivery" && drawerProject && (
        <DeliveryDrawer
          key={drawerProject.id}
          project={drawerProject}
          semester={semester}
          onClose={() => setDrawer(null)}
          onRetryFailed={() =>
            dispatch(drawerProject.id, (delivery) => delivery.state === "failed")
          }
        />
      )}
    </div>
  );
}
