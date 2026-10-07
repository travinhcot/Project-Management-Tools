"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SemesterSwitcher, type SemesterOption } from "@/shared/components/SemesterSwitcher";
import { Button } from "@/shared/components/Button";
import { ArchiveProjectDrawer } from "@/features/projects/components/drawers/ArchiveProjectDrawer";
import { ResourceFileDrawer } from "@/features/projects/components/drawers/ResourceFileDrawer";
import { ProjectMembersDrawer } from "@/features/projects/components/drawers/ProjectMembersDrawer";
import { ResourceLinkDrawer } from "@/features/projects/components/drawers/ResourceLinkDrawer";
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
  uploadResourceFile,
  type ActionResult,
  type ResourceSlotName,
} from "@/features/projects/actions";
import {
  STATUS_LABELS,
  type FileSlotName,
  type LinkSlotName,
  type ProjectFilters,
  type ProjectListPage,
  type ProjectResources,
  type ResourceSlot,
} from "@/features/projects/models/project";

type DrawerState =
  | { kind: "create" }
  | { kind: "edit"; id: string }
  | { kind: "archive"; id: string }
  | { kind: "resource"; id: string; slot: ResourceSlot }
  | { kind: "members"; id: string }
  | null;

const FILE_SLOT_NAMES: readonly ResourceSlot[] = ["SRS", "BOM", "RESEARCH_TEMPLATE"];

const DRAWER_TITLES: Record<ResourceSlot, string> = {
  SRS: "SRS file",
  FIRST_MEETING: "First meeting link",
  BOM: "BOM file",
  RESEARCH_TEMPLATE: "Research template",
  GITHUB_REPO: "GitHub repository",
  DEMO_GUIDE: "Demo video guide",
};

/** Where each slot's current value sits in the loaded resource details. */
const RESOURCE_KEY: Record<ResourceSlot, keyof ProjectResources> = {
  SRS: "srs",
  FIRST_MEETING: "meeting",
  BOM: "bom",
  RESEARCH_TEMPLATE: "researchTemplate",
  GITHUB_REPO: "githubRepo",
  DEMO_GUIDE: "demoGuide",
};

// Filters live in the URL and the list is fetched by the server component; every action
// revalidates the route, so this page keeps no copy of the projects.
export function ProjectsPage({
  list,
  filters,
  semesters,
}: {
  list: ProjectListPage;
  filters: ProjectFilters;
  semesters: SemesterOption[];
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
    if (merged.semester) params.set("semester", merged.semester);
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

  const link = (id: string, slot: LinkSlotName) => ({
    save: (value: { url: string; label: string | null }) =>
      saveResource(() => saveResourceLink(id, slot, value)),
    remove: () => remove(id, slot),
  });

  function remove(id: string, slot: ResourceSlotName) {
    saveResource(() => removeResource(id, slot));
  }

  const pageCount = Math.max(1, Math.ceil(list.total / list.size));
  const hasFilters =
    filters.search !== "" || filters.type !== "all" || filters.status !== "all";
  const statusSummary =
    filters.status === "all"
      ? "Showing all statuses"
      : `Showing ${STATUS_LABELS[filters.status]}`;

  return (
    <div className="flex flex-col gap-[22px]">
      <p className="whitespace-pre-wrap break-words text-[13px] font-medium text-muted">
        {"Workspace  /  Project Management  /  Projects"}
      </p>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-bold sm:text-[30px] text-ink">Projects</h1>
          <p className="text-sm text-muted">
            Track every project, its team, status, and setup resources.
          </p>
        </div>
        {semester && (
          <SemesterSwitcher options={semesters} selectedId={semester.id} basePath="/projects" />
        )}
      </div>

      {!semester ? (
        <section className="flex flex-col items-start gap-2 rounded-2xl bg-surface shadow-card p-5">
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

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
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
                  onEditResource={(slot) => open({ kind: "resource", id: project.id, slot })}
                  onEditMembers={() => open({ kind: "members", id: project.id })}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-surface shadow-card p-8 text-center">
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
            <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
              <span className="mr-auto text-xs text-muted sm:mr-0">
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
      {semester && drawer?.kind === "resource" && selected && (
        <ResourceLoader
          key={`${selected.id}-${drawer.slot}`}
          project={selected}
          title={DRAWER_TITLES[drawer.slot]}
          onClose={() => setDrawer(null)}
        >
          {(resources) => {
            const current = resources[RESOURCE_KEY[drawer.slot]];
            if (FILE_SLOT_NAMES.includes(drawer.slot)) {
              const slot = drawer.slot as FileSlotName;
              return (
                <ResourceFileDrawer
                  slot={slot}
                  project={selected}
                  current={current}
                  semester={semester}
                  busy={busy}
                  error={resourceError}
                  onClose={() => setDrawer(null)}
                  onSaveLink={slot === "BOM" ? link(selected.id, "BOM").save : undefined}
                  onSaveFile={(file) => {
                    const data = new FormData();
                    data.set("file", file);
                    saveResource(() => uploadResourceFile(selected.id, slot, data));
                  }}
                  onRemove={() => remove(selected.id, slot)}
                />
              );
            }
            const slot = drawer.slot as Exclude<LinkSlotName, "BOM">;
            return (
              <ResourceLinkDrawer
                slot={slot}
                project={selected}
                current={current}
                semester={semester}
                busy={busy}
                error={resourceError}
                onClose={() => setDrawer(null)}
                onSave={link(selected.id, slot).save}
                onRemove={link(selected.id, slot).remove}
              />
            );
          }}
        </ResourceLoader>
      )}
    </div>
  );
}
