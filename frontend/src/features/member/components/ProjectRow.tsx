import Link from "next/link";
import { ProjectResourceTiles } from "@/features/member/components/ProjectResources";
import type { MemberProject } from "@/features/member/models/member";
import { StatusPill } from "@/features/projects/components/StatusPill";
import { ProjectTypePill, projectTypeMeta } from "@/shared/components/ProjectTypePill";

/** One assigned project on My projects: identity on the left, setup resources on the right. */
export function ProjectRow({ project }: { project: MemberProject }) {
  return (
    <article className="flex flex-col gap-4 rounded-[10px] border border-line bg-surface p-[17px] lg:flex-row">
      <div
        className={`h-1 w-full shrink-0 rounded-sm lg:h-auto lg:w-1 ${projectTypeMeta[project.type].bar}`}
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-col items-start gap-1 lg:w-[358px] lg:shrink-0">
        <div className="flex flex-wrap items-center gap-[9px]">
          <h2 className="break-words text-lg font-semibold text-ink">{project.name}</h2>
          <StatusPill status={project.status} />
        </div>
        <ProjectTypePill type={project.type} size="sm" />
        <p className="whitespace-pre-wrap text-[13px] font-medium text-muted">
          {project.leaderName ? `(Project Leader)  ${project.leaderName}` : "No leader assigned yet"}
        </p>
        <p className="whitespace-pre-wrap text-[13px] font-medium text-muted">
          {`◯  ${project.memberCount} ${project.memberCount === 1 ? "member" : "members"}`}
        </p>
        <p className="whitespace-pre-wrap text-xs font-semibold text-success">
          {"✓  You’re on this team"}
        </p>
        <Link
          href={`/member/projects/${project.id}`}
          className="whitespace-pre-wrap text-xs font-semibold text-accent hover:underline"
        >
          {"View project  →"}
        </Link>
      </div>
      <div className="hidden w-px shrink-0 bg-line lg:block" aria-hidden="true" />
      <ProjectResourceTiles project={project} />
    </article>
  );
}
