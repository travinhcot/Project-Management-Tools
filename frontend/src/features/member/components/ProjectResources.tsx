import { AddToCalendar, ExternalLink, FileDownload } from "@/features/member/components/ResourceAction";
import type { MemberProject, MemberResource, ResourceSlot } from "@/features/member/models/member";
import { displayUrl, formatDayTime, formatSize } from "@/features/member/utils/format";

export function findResource(
  resources: readonly MemberResource[],
  slot: ResourceSlot,
): MemberResource | undefined {
  return resources.find((resource) => resource.slot === slot);
}

function Tile({
  title,
  line,
  strong,
  muted,
  children,
}: {
  title: string;
  line: string;
  strong?: boolean;
  /** Dim the text of a tile that has nothing to show. */
  muted?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 sm:min-h-[142px] flex-col items-start gap-3 rounded-lg bg-chrome p-3">
      <p className="text-[11px] font-semibold text-muted">{title}</p>
      <p
        className={`break-words text-xs ${strong ? "font-semibold" : "font-medium"} ${muted ? "text-muted" : "text-ink"}`}
      >
        {line}
      </p>
      {children}
    </div>
  );
}

const hint = "text-[11px] font-medium text-muted";

/** A file or link tile: what it is, plus the way to open it (or why there is nothing yet). */
function SlotTile({
  project,
  slot,
  title,
  emptyHint,
}: {
  project: MemberProject;
  slot: ResourceSlot;
  title: string;
  emptyHint: string;
}) {
  const resource = findResource(project.resources, slot);
  return (
    <Tile
      title={title}
      line={
        resource?.kind === "file"
          ? `${resource.filename} · ${formatSize(resource.sizeBytes)}`
          : resource?.kind === "link"
            ? (resource.label ?? displayUrl(resource.url))
            : "Not shared yet"
      }
      strong={Boolean(resource)}
      muted={!resource}
    >
      {resource?.kind === "file" ? (
        <FileDownload projectId={project.id} fileId={resource.fileId} style="text">
          Download →
        </FileDownload>
      ) : resource?.kind === "link" ? (
        <ExternalLink href={resource.url} style="text">
          Open link →
        </ExternalLink>
      ) : (
        <p className={hint}>{emptyHint}</p>
      )}
    </Tile>
  );
}

/**
 * The setup tiles of a project row: SRS, first meeting, the type's own file (BOM or research
 * template), kickstart, GitHub repo and demo video guide.
 */
export function ProjectResourceTiles({ project }: { project: MemberProject }) {
  const meeting = findResource(project.resources, "FIRST_MEETING");

  return (
    <div className="grid min-w-0 flex-1 grid-cols-1 gap-[11px] min-[480px]:grid-cols-2 sm:grid-cols-3">
      <SlotTile project={project} slot="SRS" title="SRS file" emptyHint="Your admin will add it" />

      <Tile
        title="First meeting"
        line={project.kickoffAt ? formatDayTime(project.kickoffAt) : "Not scheduled yet"}
        strong
        muted={!project.kickoffAt}
      >
        {meeting?.kind === "link" ? (
          <ExternalLink href={meeting.url} style="text">
            Open meeting link →
          </ExternalLink>
        ) : (
          <p className={hint}>
            {project.kickoffAt ? "Link not shared yet" : "Your leader will share it"}
          </p>
        )}
      </Tile>

      {project.type === "research" ? (
        <SlotTile
          project={project}
          slot="RESEARCH_TEMPLATE"
          title="Research template"
          emptyHint="Your admin will add it"
        />
      ) : project.type === "hardware" ? (
        <SlotTile project={project} slot="BOM" title="BOM file" emptyHint="Your admin will add it" />
      ) : (
        <Tile title="BOM file" line="Not applicable" muted>
          <p className={hint}>Hardware projects only</p>
        </Tile>
      )}

      <Tile
        title="Kickstart"
        line={project.kickoffAt ? formatDayTime(project.kickoffAt) : "Not scheduled yet"}
        strong
        muted={!project.kickoffAt}
      >
        {project.kickoffAt ? (
          <AddToCalendar
            title={`${project.name} · Kickstart`}
            startIso={project.kickoffAt}
            style="text"
          >
            Add to calendar →
          </AddToCalendar>
        ) : (
          <p className={hint}>Your leader will share it</p>
        )}
      </Tile>

      <SlotTile
        project={project}
        slot="GITHUB_REPO"
        title="GitHub repo"
        emptyHint="Shared after the kickstart"
      />
      <SlotTile
        project={project}
        slot="DEMO_GUIDE"
        title="Demo video guide"
        emptyHint="Shared after the kickstart"
      />
    </div>
  );
}
