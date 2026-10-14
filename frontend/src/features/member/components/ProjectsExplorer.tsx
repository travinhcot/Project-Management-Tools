"use client";

import { useMemo, useState } from "react";
import { ProjectRow } from "@/features/member/components/ProjectRow";
import type { MemberProject, SemesterAccess } from "@/features/member/models/member";
import {
  PROJECT_STATUSES,
  STATUS_LABELS,
  type ProjectStatus,
} from "@/features/projects/models/project";
import { normalizeText } from "@/features/projects/utils/format";
import { projectTypeMeta } from "@/shared/components/ProjectTypePill";
import type { ProjectType } from "@/shared/models/project";

type SemesterOption = { id: string; label: string };

/** Current first, then upcoming (soonest first), then previous (latest first). */
function semesterOptions(semesters: SemesterAccess[]): SemesterOption[] {
  const today = new Date().toISOString().slice(0, 10);
  const ended = (s: SemesterAccess) => !s.isCurrent && s.endsOn !== null && s.endsOn < today;
  const byEnd = (a: SemesterAccess, b: SemesterAccess) =>
    (a.endsOn ?? "").localeCompare(b.endsOn ?? "");
  return [
    ...semesters.filter((s) => s.isCurrent).map((s) => ({ id: s.id, label: `${s.name} (current)` })),
    ...semesters
      .filter((s) => !s.isCurrent && !ended(s))
      .sort(byEnd)
      .map((s) => ({ id: s.id, label: `${s.name} (upcoming)` })),
    ...semesters
      .filter(ended)
      .sort((a, b) => byEnd(b, a))
      .map((s) => ({ id: s.id, label: `${s.name} (previous)` })),
  ];
}

const control =
  "h-11 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink";

/** Search and filters run in the browser: a member has only a handful of projects. */
export function ProjectsExplorer({
  projects,
  semesterName,
  semesters,
  types,
}: {
  projects: MemberProject[];
  semesterName: string | null;
  /** When given, shows a semester dropdown (current, upcoming and previous). */
  semesters?: SemesterAccess[];
  /** The project types of the member's department, offered in the type filter. */
  types: readonly ProjectType[];
}) {
  const options = useMemo(() => (semesters ? semesterOptions(semesters) : []), [semesters]);
  const [semesterId, setSemesterId] = useState(options[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ProjectType | "all">("all");
  const [status, setStatus] = useState<ProjectStatus | "all">("all");

  const visible = useMemo(() => {
    const needle = normalizeText(query.trim());
    return projects.filter(
      (project) =>
        (!options.length || project.semesterId === semesterId) &&
        (type === "all" || project.type === type) &&
        (status === "all" || project.status === status) &&
        (!needle ||
          normalizeText(`${project.name} ${project.leaderName ?? ""}`).includes(needle)),
    );
  }, [projects, options, semesterId, query, type, status]);

  const shownSemester = options.length
    ? (options.find((option) => option.id === semesterId)?.label ?? semesterName)
    : semesterName;
  const filtered = query.trim() !== "" || type !== "all" || status !== "all";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {options.length > 0 && (
          <label>
            <span className="sr-only">Semester</span>
            <select
              value={semesterId}
              onChange={(event) => setSemesterId(event.target.value)}
              className={`${control} w-[200px]`}
            >
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
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
            {types.map((value) => (
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
          {shownSemester ? `${shownSemester} · ` : ""}Read-only view
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
