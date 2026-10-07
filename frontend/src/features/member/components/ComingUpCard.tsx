import {
  AddToCalendar,
  ExternalLink,
  FileDownload,
} from "@/features/member/components/ResourceAction";
import type { ComingUpItem } from "@/features/member/models/member";
import { displayUrl, formatSize, formatWeekdayTime } from "@/features/member/utils/format";
import { Pill } from "@/shared/components/Pill";

function title(item: ComingUpItem): string {
  switch (item.kind) {
    case "FIRST_MEETING":
      return `${item.projectName} · First meeting`;
    case "KICKOFF":
      return `${item.projectName} · Kickstart session`;
    case "BOM":
      return `${item.projectName} · BOM file shared`;
  }
}

function detail(item: ComingUpItem): string {
  if (item.kind === "BOM" && item.file) {
    return `${item.file.filename} · ${formatSize(item.file.sizeBytes)}`;
  }
  const parts = [item.at ? formatWeekdayTime(item.at) : null, item.url ? displayUrl(item.url) : null];
  return parts.filter(Boolean).join(" · ");
}

function Action({ item }: { item: ComingUpItem }) {
  if (item.kind === "BOM" && item.file) {
    return (
      <FileDownload projectId={item.projectId} fileId={item.file.id} style="textLarge">
        Download →
      </FileDownload>
    );
  }
  if (item.kind === "FIRST_MEETING" && item.url) {
    return (
      <ExternalLink href={item.url} style="textLarge">
        Open link →
      </ExternalLink>
    );
  }
  if (item.at) {
    return (
      <AddToCalendar
        title={title(item)}
        startIso={item.at}
        location={item.url}
        style="textLarge"
      >
        Add to calendar →
      </AddToCalendar>
    );
  }
  return null;
}

export function ComingUpCard({ items }: { items: ComingUpItem[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface shadow-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Coming up</h2>
        {items.length > 0 && (
          <Pill tone="cyan">
            {items.length} {items.length === 1 ? "item" : "items"}
          </Pill>
        )}
      </div>
      <p className="text-[13px] text-muted">Meetings and files shared with your teams.</p>
      {items.length === 0 ? (
        <p className="rounded-lg bg-chrome p-3 text-xs text-muted">
          Nothing is scheduled or shared yet. New meetings and files show up here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={`${item.kind}-${item.projectId}`}
              className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 rounded-lg bg-chrome p-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="break-words text-[13px] font-semibold text-ink">{title(item)}</p>
                <p className="break-words text-xs text-muted">{detail(item)}</p>
              </div>
              <Action item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
