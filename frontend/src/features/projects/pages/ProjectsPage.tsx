"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SemesterBadge } from "@/shared/components/SemesterBadge";
import { Button } from "@/shared/components/Button";
import { ArchiveProjectDrawer } from "@/features/projects/components/drawers/ArchiveProjectDrawer";
import { BomFileDrawer } from "@/features/projects/components/drawers/BomFileDrawer";
import { ProjectMembersDrawer } from "@/features/projects/components/drawers/ProjectMembersDrawer";
import { MeetingLinkDrawer } from "@/features/projects/components/drawers/MeetingLinkDrawer";
import { ProjectFormDrawer } from "@/features/projects/components/drawers/ProjectFormDrawer";
import { ProjectRow } from "@/features/projects/components/ProjectRow";
import { ProjectsToolbar } from "@/features/projects/components/ProjectsToolbar";
import { ResourceLoader } from "@/features/projects/components/ResourceLoader";
import {
  archiveProject,
  createProject,
  removeResource,
  saveResourceLink,
  updateProject,
  uploadBomFile,
  type ActionResult,
  type ResourceSlotName,
} from "@/features/projects/actions";
import {
  STATUS_LABELS,
  type ProjectFilters,
  type ProjectListPage,
} from "@/features/projects/models/project";

type DrawerState =
  | { kind: "create" }
  | { kind: "edit"; id: string }
  | { kind: "archive"; id: string }
  | { kind: "meeting"; id: string }
  | { kind: "bom"; id: string }
  | { kind: "members"; id: string }
  | null;

// Filters live in the URL and the list is fetched by the server component; every action
// revalidates the route, so this page keeps no copy of the projects.
export function ProjectsPage({
  list,
  filters,
}: {
  list: ProjectListPage;
  filters: ProjectFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { semester, items: projects } = list;
  const [search, setSearch] = useState(filters.search);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [resourceError, setResourceError] = useState<string>();
  const [busy, startWork] = useTransition();

  function navigate(next: Partial<ProjectFilters>) {
    const merged = { ...filters, page: 1, ...next };
    const params = new URLSearchParams();
    if (merged.search) params.set("q", merged.search);
    if (merged.type !== "all") params.set("type", merged.type);
    if (merged.status !== "all") params.set("status", merged.status);
    if (merged.page > 1) params.set("page", String(merged.page));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  // Debounce typing into the URL; skip when the box already matches it.
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === filters.search) return;
    const timer = setTimeout(() => navigate({ search: trimmed }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const selected =
    drawer && drawer.kind !== "create"
      ? projects.find((project) => project.id === drawer.id)
      : undefined;

  function open(next: DrawerState) {
    setResourceError(undefined);
    setDrawer(next);
  }

  /** Runs a resource write; closes the drawer on success, otherwise shows the backend message. */
  function saveResource(work: () => Promise<ActionResult>) {
    setResourceError(undefined);
    startWork(async () => {
      const result = await work();
      if (result.ok) setDrawer(null);
      else setResourceError(result.message);
    });
  }

  const link = (id: string, slot: ResourceSlotName) => ({
    save: (value: { url: string; label: string | null }) =>
      saveResource(() => saveResourceLink(id, slot, value)),
    remove: () => saveResource(() => removeResource(id, slot)),
  });

  const pageCount = Math.max(1, Math.ceil(list.total / list.size));
  const hasFilters =
    filters.search !== "" || filters.type !== "all" || filters.status !== "all";
  const statusSummary =
    filters.status === "all"
      ? "Showing all statuses"
      : `Showing ${STATUS_LABELS[filters.status]}`;

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
        {semester && <SemesterBadge name={semester.name} active={semester.active} />}
      </div>

      {!semester ? (
        <section className="flex flex-col items-start gap-2 rounded-[10px] border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold text-ink">No current semester</h2>
          <p className="text-[13px] text-muted">
            Set a current semester before creating projects.
          </p>
          <Link href="/semesters" className="text-[13px] font-semibold text-accent">
            Go to semesters →
          </Link>
        </section>
      ) : (
        <>
          <ProjectsToolbar
            query={search}
            onQueryChange={setSearch}
            type={filters.type}
            onTypeChange={(value) => navigate({ type: value as ProjectFilters["type"] })}
            status={filters.status}
            onStatusChange={(value) =>
              navigate({ status: value as ProjectFilters["status"] })
            }
            onCreate={() => open({ kind: "create" })}
          />

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-ink" aria-live="polite">
              {list.total} {list.total === 1 ? "project" : "projects"}
            </p>
            <p className="text-xs font-medium text-muted">
              {semester.name} · {statusSummary}
            </p>
          </div>

          {projects.length > 0 ? (
            <div className="flex flex-col gap-[13px]">
              {projects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  onEdit={() => open({ kind: "edit", id: project.id })}
                  onEditMeeting={() => open({ kind: "meeting", id: project.id })}
                  onEditBom={() => open({ kind: "bom", id: project.id })}
                  onEditMembers={() => open({ kind: "members", id: project.id })}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[10px] border border-line bg-surface p-8 text-center">
              <p className="text-[15px] font-semibold text-ink">
                {hasFilters ? "No projects match your filters" : "No projects yet"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {hasFilters
                  ? "Try a different search, type or status."
                  : "Create the first project for this semester."}
              </p>
            </div>
          )}

          {pageCount > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-end gap-3">
              <span className="text-xs text-muted">
                Page {list.page} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={list.page <= 1}
                onClick={() => navigate({ page: list.page - 1 })}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={list.page >= pageCount}
                onClick={() => navigate({ page: list.page + 1 })}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}

      {semester && drawer?.kind === "create" && (
        <ProjectFormDrawer
          mode="create"
          semester={semester}
          onClose={() => setDrawer(null)}
          onSubmit={(input) => createProject(semester.id, input)}
        />
      )}
      {semester && drawer?.kind === "edit" && selected && (
        <ProjectFormDrawer
          key={selected.id}
          mode="edit"
          project={selected}
          semester={semester}
          onClose={() => setDrawer(null)}
          onSubmit={(input, changes, loadedAt) => updateProject(selected.id, loadedAt, changes)}
          onArchive={() => open({ kind: "archive", id: selected.id })}
        />
      )}
      {semester && drawer?.kind === "archive" && selected && (
        <ArchiveProjectDrawer
          key={selected.id}
          project={selected}
          semester={semester}
          onClose={() => setDrawer(null)}
          onConfirm={({ cancelKickoff }) => archiveProject(selected.id, cancelKickoff)}
        />
      )}
      {semester && drawer?.kind === "members" && selected && (
        <ProjectMembersDrawer
          key={selected.id}
          project={selected}
          semester={semester}
          onClose={() => setDrawer(null)}
        />
      )}
      {semester && drawer?.kind === "meeting" && selected && (
        <ResourceLoader
          key={selected.id}
          project={selected}
          title="First meeting link"
          onClose={() => setDrawer(null)}
        >
          {(resources) => (
            <MeetingLinkDrawer
              project={{
                name: selected.name,
                meetingUrl: resources.meetingUrl,
                meetingLabel: resources.meetingLabel,
              }}
              semester={semester}
              busy={busy}
              error={resourceError}
              onClose={() => setDrawer(null)}
              onSave={link(selected.id, "FIRST_MEETING").save}
              onRemove={link(selected.id, "FIRST_MEETING").remove}
            />
          )}
        </ResourceLoader>
      )}
      {semester && drawer?.kind === "bom" && selected && (
        <ResourceLoader
          key={selected.id}
          project={selected}
          title="BOM file"
          onClose={() => setDrawer(null)}
        >
          {(resources) => (
            <BomFileDrawer
              project={selected}
              current={resources.bom}
              semester={semester}
              busy={busy}
              error={resourceError}
              onClose={() => setDrawer(null)}
              onSaveLink={link(selected.id, "BOM").save}
              onSaveFile={(file) => {
                const data = new FormData();
                data.set("file", file);
                saveResource(() => uploadBomFile(selected.id, data));
              }}
              onRemove={link(selected.id, "BOM").remove}
            />
          )}
        </ResourceLoader>
      )}
    </div>
  );
}
