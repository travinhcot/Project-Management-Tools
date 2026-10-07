"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProjectResourceTiles } from "@/features/member/components/ProjectResources";
import { getProjectTeammates } from "@/features/member/actions";
import type { MemberProject, Teammate } from "@/features/member/models/member";
import { StatusPill } from "@/features/projects/components/StatusPill";
import { ProjectTypePill, projectTypeMeta } from "@/shared/components/ProjectTypePill";

/** One assigned project on My projects: identity on the left, setup resources on the right. */
function TeamList({ projectId }: { projectId: string }) {
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "ready"; teammates: Teammate[] }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getProjectTeammates(projectId).then((result) => {
      if (cancelled) return;
      setState(
        result.ok
          ? { status: "ready", teammates: result.teammates }
          : { status: "error", message: result.message },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (state.status === "loading") return <p className="text-[13px] text-muted">Loading team…</p>;
  if (state.status === "error") return <p role="alert" className="text-[13px] text-danger">{state.message}</p>;
  return (
    <ul className="flex w-full flex-col gap-1.5">
      {state.teammates.map((mate) => (
        <li key={`${mate.fullName}-${mate.isLeader}`} className="flex items-center justify-between gap-2 text-[13px] text-ink">
          <span className="min-w-0 break-words">{mate.fullName}</span>
          {mate.isLeader && <span className="shrink-0 text-[11px] text-warn-text">Project leader</span>}
        </li>
      ))}
    </ul>
  );
}

export function ProjectRow({ project }: { project: MemberProject }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="flex flex-col gap-4 rounded-2xl bg-surface shadow-card p-[17px] lg:flex-row">
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
