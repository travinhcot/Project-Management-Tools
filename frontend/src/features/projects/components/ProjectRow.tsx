import { Button } from "@/shared/components/Button";
import {
  ProjectTypePill,
  projectTypeMeta,
} from "@/shared/components/ProjectTypePill";
import { ResourceTile } from "@/features/projects/components/ResourceTile";
import { StatusPill } from "@/features/projects/components/StatusPill";
import type { Project } from "@/features/projects/models/project";
import { formatKickoff } from "@/features/projects/utils/format";

export function ProjectRow({
  project,
  onEdit,
  onEditMeeting,
  onEditBom,
  onEditMembers,
}: {
  project: Project;
  onEdit: () => void;
  onEditMeeting: () => void;
  onEditBom: () => void;
  onEditMembers: () => void;
}) {
  const isHardware = project.type === "hardware";
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
        <Button
          variant="link"
          size="sm"
          className="mt-auto w-full sm:w-[190px]"
          onClick={onEditMembers}
        >
          Add / remove members
        </Button>
      </div>

      <div className="h-px w-full shrink-0 bg-line xl:h-auto xl:w-px" />

      <div className="grid min-w-0 flex-1 grid-cols-1 gap-[11px] min-[480px]:grid-cols-2 xl:grid-cols-3">
        {project.hasMeeting ? (
          <ResourceTile
            label="First meeting"
            state="set"
            value="Open meeting link"
            onOpen={onEditMeeting}
          />
        ) : (
          <ResourceTile
            label="First meeting"
            state="missing"
            value="Add meeting link"
            onOpen={onEditMeeting}
          />
        )}

        {!isHardware ? (
          <ResourceTile
            label="BOM file"
            state="na"
            value="Not applicable"
            note="Hardware only"
          />
        ) : project.hasBom ? (
          <ResourceTile
            label="BOM file"
            state="set"
            value="View BOM"
            onOpen={onEditBom}
          />
        ) : (
          <ResourceTile
            label="BOM file"
            state="missing"
            value="Upload BOM file"
            onOpen={onEditBom}
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
      </div>
    </article>
  );
}
