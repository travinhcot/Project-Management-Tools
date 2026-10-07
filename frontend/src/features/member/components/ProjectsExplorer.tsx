"use client";

import { useMemo, useState } from "react";
import { ProjectRow } from "@/features/member/components/ProjectRow";
import type { MemberProject } from "@/features/member/models/member";
import {
  PROJECT_STATUSES,
  STATUS_LABELS,
  type ProjectStatus,
} from "@/features/projects/models/project";
import { normalizeText } from "@/features/projects/utils/format";
import { projectTypeMeta } from "@/shared/components/ProjectTypePill";
import { PROJECT_TYPES, type ProjectType } from "@/shared/models/project";

const control =
  "h-11 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink";

/** Search and filters run in the browser: a member has only a handful of projects. */
export function ProjectsExplorer({
  projects,
  semesterName,
}: {
  projects: MemberProject[];
  semesterName: string | null;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ProjectType | "all">("all");
  const [status, setStatus] = useState<ProjectStatus | "all">("all");

  const visible = useMemo(() => {
    const needle = normalizeText(query.trim());
    return projects.filter(
      (project) =>
        (type === "all" || project.type === type) &&
        (status === "all" || project.status === status) &&
        (!needle ||
          normalizeText(`${project.name} ${project.leaderName ?? ""}`).includes(needle)),
    );
  }, [projects, query, type, status]);

  const filtered = query.trim() !== "" || type !== "all" || status !== "all";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[200px] flex-1 sm:max-w-[424px]">
          <span className="sr-only">Search my projects</span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl leading-none text-placeholder"
          >
            ⌕
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search my projects"
            className={`${control} w-full pl-10 font-normal placeholder:text-placeholder`}
          />
        </label>
        <label>
          <span className="sr-only">Project type</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value as ProjectType | "all")}
            className={`${control} w-[142px]`}
          >
            <option value="all">All types</option>
            {PROJECT_TYPES.map((value) => (
              <option key={value} value={value}>
                {projectTypeMeta[value].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Project status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ProjectStatus | "all")}
            className={`${control} w-[150px]`}
          >
            <option value="all">Status</option>
            {PROJECT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink" aria-live="polite">
          {visible.length} assigned {visible.length === 1 ? "project" : "projects"}
        </p>
        <p className="text-xs font-medium text-muted">
          {semesterName ? `${semesterName} · ` : ""}Read-only view
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-surface shadow-card p-5 text-[13px] text-muted">
          {filtered
            ? "No projects match your search or filters."
            : "You have no assigned projects yet — contact EBMB."}
        </p>
      ) : (
        <div className="flex flex-col gap-[13px]">
          {visible.map((project) => (
            <ProjectRow key={project.id} project={project} />
          ))}
        </div>
      )}
    </>
  );
}
