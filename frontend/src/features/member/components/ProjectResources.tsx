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

/** The three setup tiles of a project row: first meeting, BOM file and kickstart. */
export function ProjectResourceTiles({ project }: { project: MemberProject }) {
  const meeting = findResource(project.resources, "FIRST_MEETING");
  const bom = findResource(project.resources, "BOM");
  const hardware = project.type === "hardware";

  return (
    <div className="grid min-w-0 flex-1 grid-cols-1 gap-[11px] sm:grid-cols-3">
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

      <Tile
        title="BOM file"
        line={
          !hardware
            ? "Not applicable"
            : bom?.kind === "file"
              ? `${bom.filename} · ${formatSize(bom.sizeBytes)}`
              : bom?.kind === "link"
                ? displayUrl(bom.url)
                : "Not shared yet"
        }
        strong={hardware && Boolean(bom)}
        muted={!hardware || !bom}
      >
        {!hardware ? (
          <p className={hint}>Software project</p>
        ) : bom?.kind === "file" ? (
          <FileDownload projectId={project.id} fileId={bom.fileId} style="text">
            Download →
          </FileDownload>
        ) : bom?.kind === "link" ? (
          <ExternalLink href={bom.url} style="text">
            Open link →
          </ExternalLink>
        ) : (
          <p className={hint}>Your admin will add it</p>
        )}
      </Tile>

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
    </div>
  );
}
