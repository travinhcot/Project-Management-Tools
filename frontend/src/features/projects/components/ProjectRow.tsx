"use client";

import { Button } from "@/shared/components/Button";
import {
  ProjectTypePill,
  projectTypeMeta,
} from "@/shared/components/ProjectTypePill";
import { ProjectMemberList } from "@/features/projects/components/ProjectMemberList";
import { ResourceTile } from "@/features/projects/components/ResourceTile";
import { StatusPill } from "@/features/projects/components/StatusPill";
import type { Project, ResourceSlot } from "@/features/projects/models/project";
import { formatKickoff } from "@/features/projects/utils/format";

/** Tile wording per slot. Which slots a project shows comes from the backend's resource summary. */
const SLOT_TILES: Record<ResourceSlot, { label: string; set: string; add: string }> = {
  SRS: { label: "SRS file", set: "View SRS", add: "Upload SRS (PDF)" },
  FIRST_MEETING: { label: "First meeting", set: "Open meeting link", add: "Add meeting link" },
  BOM: { label: "BOM file", set: "View BOM", add: "Upload BOM file" },
  RESEARCH_TEMPLATE: { label: "Research template", set: "View template", add: "Upload template" },
  GITHUB_REPO: { label: "GitHub repo", set: "Open repo link", add: "Add repo link" },
  DEMO_GUIDE: { label: "Demo video guide", set: "Open guide link", add: "Add guide link" },
};

function SlotTile({
  project,
  slot,
  onOpen,
}: {
  project: Project;
  slot: ResourceSlot;
  onOpen: (slot: ResourceSlot) => void;
}) {
  const { label, set, add } = SLOT_TILES[slot];
  const open = () => onOpen(slot);
  if (project.resources.present.includes(slot))
    return <ResourceTile label={label} state="set" value={set} onOpen={open} />;
  // Required slots that are empty are warnings; optional ones (repo, demo guide) stay quiet.
  return (
    <ResourceTile
      label={label}
      state={project.resources.missing.includes(slot) ? "missing" : "empty"}
      value={add}
      onOpen={open}
    />
  );
}

export function ProjectRow({
  project,
  onEdit,
  onEditResource,
  onEditMembers,
  onOpenGithub,
  onArchive,
}: {
  project: Project;
  onEdit: () => void;
  onEditResource: (slot: ResourceSlot) => void;
  onEditMembers: () => void;
  onOpenGithub: () => void;
  onArchive: () => void;
}) {
  const memberLabel = project.memberCount === 1 ? "member" : "members";

  return (
    <article className="flex flex-col gap-4 rounded-2xl bg-surface shadow-card p-[17px] xl:flex-row">
      <div
        className={`h-1 w-full shrink-0 rounded-sm xl:h-auto xl:w-1 xl:self-stretch ${projectTypeMeta[project.type].bar}`}
      />

      <div className="flex w-full min-w-0 shrink-0 flex-col items-start gap-1 xl:w-[358px]">
        <div className="mb-1.5 flex min-h-[29px] min-w-0 max-w-full flex-wrap items-center gap-x-[9px] gap-y-1">
          <h2 className="min-w-0 break-words text-lg font-semibold text-ink">
            <button
              type="button"
              onClick={onEdit}
              className="max-w-full break-words rounded text-left hover:text-accent focus-visible:outline-2 focus-visible:outline-primary"
            >
              {project.name}
            </button>
          </h2>
          <StatusPill status={project.status} />
        </div>
        <ProjectTypePill type={project.type} size="sm" />
        <p className="whitespace-pre-wrap break-words text-[13px] font-medium text-muted">
          {"(Project Leader)  "}
          {project.leaderName ?? "Not assigned"}
        </p>
        <p className="whitespace-pre-wrap break-words text-[13px] font-medium text-muted">
          <span aria-hidden="true">◯  </span>
          {project.memberCount} {memberLabel}
        </p>
        {project.memberCount > 0 && (
          <div className="w-full rounded-[10px] bg-chrome p-2.5">
            <ProjectMemberList projectId={project.id} memberCount={project.memberCount} />
          </div>
        )}
        <div className="mt-auto flex w-full flex-wrap gap-2">
          <Button variant="link" size="sm" className="w-full sm:w-[190px]" onClick={onEditMembers}>
            Add / remove members
          </Button>
          <Button variant="link" size="sm" className="w-full sm:w-auto" onClick={onOpenGithub}>
            GitHub activity
          </Button>
          <Button variant="danger-outline" size="sm" className="w-full sm:w-auto" onClick={onArchive}>
            Archive project
          </Button>
        </div>
      </div>

      <div className="h-px w-full shrink-0 bg-line xl:h-auto xl:w-px" />

      <div className="grid min-w-0 flex-1 grid-cols-1 gap-[11px] min-[480px]:grid-cols-2 xl:grid-cols-3">
        <SlotTile project={project} slot="SRS" onOpen={onEditResource} />
        <SlotTile project={project} slot="FIRST_MEETING" onOpen={onEditResource} />

        {project.type === "research" ? (
          <SlotTile project={project} slot="RESEARCH_TEMPLATE" onOpen={onEditResource} />
        ) : project.type === "hardware" ? (
          <SlotTile project={project} slot="BOM" onOpen={onEditResource} />
        ) : (
          <ResourceTile
            label={SLOT_TILES.BOM.label}
            state="na"
            value="Not applicable"
            note="Hardware only"
          />
        )}

        {project.kickoffAt ? (
          <ResourceTile
            label="Kickstart"
            state="set"
            value={formatKickoff(project.kickoffAt)}
            onOpen={onEdit}
          />
        ) : (
          <ResourceTile
            label="Kickstart"
            state="missing"
            value="Set kickstart date"
            onOpen={onEdit}
          />
        )}

        <SlotTile project={project} slot="GITHUB_REPO" onOpen={onEditResource} />
        <SlotTile project={project} slot="DEMO_GUIDE" onOpen={onEditResource} />
      </div>
    </article>
  );
}
