"use client";

import { useMemo, useState } from "react";
import { SemesterBadge } from "@/shared/components/SemesterBadge";
import { ArchiveProjectDrawer } from "@/features/projects/components/drawers/ArchiveProjectDrawer";
import { BomFileDrawer } from "@/features/projects/components/drawers/BomFileDrawer";
import { MeetingLinkDrawer } from "@/features/projects/components/drawers/MeetingLinkDrawer";
import { ProjectFormDrawer } from "@/features/projects/components/drawers/ProjectFormDrawer";
import { ProjectRow } from "@/features/projects/components/ProjectRow";
import { ProjectsToolbar } from "@/features/projects/components/ProjectsToolbar";
import {
  STATUS_LABELS,
  type Project,
  type ProjectBom,
  type ProjectInput,
  type ProjectStatus,
  type SemesterSummary,
} from "@/features/projects/models/project";
import { normalizeText } from "@/features/projects/utils/format";

type DrawerState =
  | { kind: "create" }
  | { kind: "edit"; id: string }
  | { kind: "archive"; id: string }
  | { kind: "meeting"; id: string }
  | { kind: "bom"; id: string }
  | null;

// Create / edit / archive only change local state until the admin projects API is wired.
export function ProjectsPage({
  semester,
  initialProjects,
}: {
  semester: SemesterSummary;
  initialProjects: Project[];
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [drawer, setDrawer] = useState<DrawerState>(null);

  const visible = useMemo(() => {
    const needle = normalizeText(query.trim());
    return projects.filter((project) => {
      if (type !== "all" && project.type !== type) return false;
      if (status !== "all" && project.status !== status) return false;
      if (!needle) return true;
      return normalizeText(`${project.name} ${project.leaderName ?? ""}`).includes(
        needle,
      );
    });
  }, [projects, query, type, status]);

  const selected =
    drawer && drawer.kind !== "create"
      ? projects.find((project) => project.id === drawer.id)
      : undefined;

  function createProject(input: ProjectInput) {
    const project: Project = {
      id: crypto.randomUUID(),
      ...input,
      status: "planning",
      leaderName: null,
      memberCount: 0,
      meetingUrl: null,
      meetingLabel: null,
      bom: null,
      kickoffAt: null,
    };
    setProjects((current) => [project, ...current]);
    setDrawer(null);
  }

  function updateProject(id: string, input: ProjectInput) {
    setProjects((current) =>
      current.map((project) =>
        project.id === id ? { ...project, ...input } : project,
      ),
    );
    setDrawer(null);
  }

  function patchProject(id: string, patch: Partial<Project>) {
    setProjects((current) =>
      current.map((project) =>
        project.id === id ? { ...project, ...patch } : project,
      ),
    );
    setDrawer(null);
  }

  function saveMeeting(
    id: string,
    link: { url: string; label: string | null } | null,
  ) {
    patchProject(id, {
      meetingUrl: link?.url ?? null,
      meetingLabel: link?.label ?? null,
    });
  }

  function saveBom(id: string, bom: ProjectBom | null) {
    patchProject(id, { bom });
  }

  function archiveProject(id: string) {
    setProjects((current) => current.filter((project) => project.id !== id));
    setDrawer(null);
  }

  const statusSummary =
    status === "all"
      ? "Showing all statuses"
      : `Showing ${STATUS_LABELS[status as ProjectStatus]}`;

  return (
    <div className="flex flex-col gap-[22px]">
      <p className="whitespace-pre text-[13px] font-medium text-muted">
        {"Workspace  /  Project Management  /  Projects"}
      </p>

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[30px] font-bold text-ink">Projects</h1>
          <p className="text-sm text-muted">
            Track every project, its team, status, and setup resources.
          </p>
        </div>
        <SemesterBadge name={semester.name} active={semester.active} />
      </div>

      <ProjectsToolbar
        query={query}
        onQueryChange={setQuery}
        type={type}
        onTypeChange={setType}
        status={status}
        onStatusChange={setStatus}
        onCreate={() => setDrawer({ kind: "create" })}
      />

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-ink" aria-live="polite">
          {visible.length} {visible.length === 1 ? "project" : "projects"}
        </p>
        <p className="text-xs font-medium text-muted">
          {semester.name} · {statusSummary}
        </p>
      </div>

      {visible.length > 0 ? (
        <div className="flex flex-col gap-[13px]">
          {visible.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              onEdit={() => setDrawer({ kind: "edit", id: project.id })}
              onEditMeeting={() => setDrawer({ kind: "meeting", id: project.id })}
              onEditBom={() => setDrawer({ kind: "bom", id: project.id })}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[10px] border border-line bg-surface p-8 text-center">
          <p className="text-[15px] font-semibold text-ink">
            No projects match your filters
          </p>
          <p className="mt-1 text-xs text-muted">
            Try a different search, type or status.
          </p>
        </div>
      )}

      {drawer?.kind === "create" && (
        <ProjectFormDrawer
          mode="create"
          semester={semester}
          onClose={() => setDrawer(null)}
          onSubmit={createProject}
        />
      )}
      {drawer?.kind === "edit" && selected && (
        <ProjectFormDrawer
          key={selected.id}
          mode="edit"
          project={selected}
          semester={semester}
          onClose={() => setDrawer(null)}
          onSubmit={(input) => updateProject(selected.id, input)}
          onArchive={() => setDrawer({ kind: "archive", id: selected.id })}
        />
      )}
      {drawer?.kind === "archive" && selected && (
        <ArchiveProjectDrawer
          key={selected.id}
          project={selected}
          semester={semester}
          onClose={() => setDrawer(null)}
          onConfirm={() => archiveProject(selected.id)}
        />
      )}
      {drawer?.kind === "meeting" && selected && (
        <MeetingLinkDrawer
          key={selected.id}
          project={selected}
          semester={semester}
          onClose={() => setDrawer(null)}
          onSave={(link) => saveMeeting(selected.id, link)}
          onRemove={() => saveMeeting(selected.id, null)}
        />
      )}
      {drawer?.kind === "bom" && selected && (
        <BomFileDrawer
          key={selected.id}
          project={selected}
          semester={semester}
          onClose={() => setDrawer(null)}
          onSave={(bom) => saveBom(selected.id, bom)}
          onRemove={() => saveBom(selected.id, null)}
        />
      )}
    </div>
  );
}
