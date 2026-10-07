import Link from "next/link";
import type { MemberProject } from "@/features/member/models/member";
import { formatDay } from "@/features/member/utils/format";
import { ProjectTypePill, projectTypeMeta } from "@/shared/components/ProjectTypePill";

/** Compact card for the Overview page; opens the project. */
export function ProjectPreviewCard({ project }: { project: MemberProject }) {
  return (
    <Link
      href={`/member/projects/${project.id}`}
      className="flex flex-col items-start gap-3 rounded-2xl bg-surface shadow-card p-5 hover:ring-1 hover:ring-link-line"
    >
      <div className={`h-1 w-full rounded-sm ${projectTypeMeta[project.type].bar}`} />
      <ProjectTypePill type={project.type} />
      <h3 className="text-[17px] font-semibold text-ink">{project.name}</h3>
      <p className="text-xs text-muted">
        You’re a member{project.leaderName ? ` · Leader: ${project.leaderName}` : ""}
      </p>
      <p className="whitespace-pre text-xs font-medium text-muted">
        {project.memberCount} {project.memberCount === 1 ? "member" : "members"}
        {"   ·   "}
        {project.kickoffAt
          ? `${project.type === "hardware" ? "Kickstart" : "First meeting"} ${formatDay(project.kickoffAt)}`
          : "Not scheduled yet"}
      </p>
    </Link>
  );
}
