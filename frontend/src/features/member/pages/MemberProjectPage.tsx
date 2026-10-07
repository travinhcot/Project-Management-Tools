import { notFound } from "next/navigation";
import {
  AddToCalendar,
  ExternalLink,
  FileDownload,
} from "@/features/member/components/ResourceAction";
import { MemberPageHeader } from "@/features/member/components/MemberPageHeader";
import { NoAccessCard } from "@/features/member/components/NoAccessCard";
import { findResource } from "@/features/member/components/ProjectResources";
import type {
  MemberProjectDetail,
  MemberResource,
  Teammate,
} from "@/features/member/models/member";
import {
  getMemberProject,
  getMemberStatus,
} from "@/features/member/service/member.service";
import { displayUrl, formatDayTime, formatSize } from "@/features/member/utils/format";
import { StatusPill } from "@/features/projects/components/StatusPill";
import { ApiError } from "@/shared/api/errors";
import { Pill } from "@/shared/components/Pill";
import { ProjectTypePill } from "@/shared/components/ProjectTypePill";

const initial = (name: string) => name.trim().split(/\s+/).at(-1)?.charAt(0).toUpperCase() ?? "?";

function ResourceItem({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-chrome px-4 py-3.5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="break-words text-xs text-muted">{detail}</p>
      </div>
      {action}
    </div>
  );
}

function resourceAction(projectId: string, resource: MemberResource) {
  return resource.kind === "file" ? (
    <FileDownload projectId={projectId} fileId={resource.fileId} style="primary">
      Download
    </FileDownload>
  ) : (
    <ExternalLink href={resource.url} style="outline">
      Open link
    </ExternalLink>
  );
}

function resourceDetail(resource: MemberResource): string {
  return resource.kind === "file"
    ? `${resource.filename} · ${formatSize(resource.sizeBytes)}`
    : displayUrl(resource.url);
}

function Resources({ project }: { project: MemberProjectDetail }) {
  const srs = findResource(project.resources, "SRS");
  const meeting = findResource(project.resources, "FIRST_MEETING");
  const bom = findResource(project.resources, "BOM");

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-3.5 rounded-2xl bg-surface shadow-card p-5">
      <h2 className="text-xl font-semibold text-ink">Resources</h2>
      {srs && (
        <ResourceItem
          title="SRS document"
          detail={resourceDetail(srs)}
          action={resourceAction(project.id, srs)}
        />
      )}
      {(meeting || project.kickoffAt) && (
        <ResourceItem
          title="First meeting"
          detail={[
            project.kickoffAt ? formatDayTime(project.kickoffAt) : null,
            meeting ? resourceDetail(meeting) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          action={meeting && resourceAction(project.id, meeting)}
        />
      )}
      {bom && (
        <ResourceItem
          title="Bill of materials (BOM)"
          detail={resourceDetail(bom)}
          action={resourceAction(project.id, bom)}
        />
      )}
      <ResourceItem
        title="Kickstart"
        detail={
          project.kickoffAt
            ? formatDayTime(project.kickoffAt)
            : "Not scheduled yet — your leader will share the date"
        }
        action={
          project.kickoffAt && (
            <AddToCalendar
              title={`${project.name} · Kickstart`}
              startIso={project.kickoffAt}
              style="outline"
            >
              Add to calendar
            </AddToCalendar>
          )
        }
      />
      <p className="text-xs text-muted">
        Download links are created when you click and expire after 5 minutes. Resources your
        admin hasn’t added yet show as not shared.
      </p>
    </section>
  );
}

function TeamCard({ teammates, me }: { teammates: Teammate[]; me: string | null }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-2xl bg-surface shadow-card p-5">
      <h2 className="text-xl font-semibold text-ink">Your team · {teammates.length}</h2>
      {teammates.map((mate) => {
        const you = me !== null && mate.fullName === me;
        return (
          <div
            key={`${mate.fullName}-${mate.isLeader}`}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${you ? "bg-accent-soft" : ""}`}
          >
            <span
              aria-hidden="true"
              className={`flex size-[30px] shrink-0 items-center justify-center rounded-full text-xs font-semibold text-accent ${you ? "bg-surface" : "bg-accent-soft"}`}
            >
              {initial(mate.fullName)}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="break-words text-[13px] font-semibold text-ink">{mate.fullName}</p>
              <p className={`text-[11px] ${mate.isLeader ? "text-warn-text" : "text-muted"}`}>
                {you ? "You" : mate.isLeader ? "Project leader" : "Member"}
              </p>
            </div>
          </div>
        );
      })}
    </section>
  );
}

export async function MemberProjectPage({ id }: { id: string }) {
  const status = await getMemberStatus();
  if (!status.eligible) return <NoAccessCard email={status.email} />;

  let project: MemberProjectDetail;
  try {
    project = await getMemberProject(id);
  } catch (error) {
    // Unknown and not-yours look the same on purpose (the backend answers 404 for both).
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <MemberPageHeader
        breadcrumb={`Workspace  /  Project Management  /  My projects  /  ${project.name}`}
        title={project.name}
        subtitle={project.description ?? "Resources and team for this project."}
        semesterName={project.semesterName}
        back={{ href: "/member/projects", label: "←  Back to my projects" }}
      />

      <div className="flex flex-wrap gap-2">
        <ProjectTypePill type={project.type} />
        <StatusPill status={project.status} />
        <Pill tone="success">✓ You’re on this team</Pill>
      </div>

      <div className="flex flex-col items-stretch gap-5 lg:flex-row lg:items-start">
        <Resources project={project} />
        <div className="flex w-full shrink-0 flex-col gap-5 lg:w-[360px]">
          <TeamCard teammates={project.teammates} me={status.fullName} />
          <section className="flex flex-col gap-2 rounded-2xl bg-surface shadow-card p-5">
            <h2 className="text-sm font-semibold text-ink">Need a change?</h2>
            <p className="text-xs text-muted">
              Team changes and resource updates are handled by EBMB admins. Contact your project
              leader or an admin.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
