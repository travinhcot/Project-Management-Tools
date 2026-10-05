import type {
  ProjectType,
  ResourceRecord,
  ResourceView,
} from "../model/portal.model.ts";

import { SLOT_ORDER } from "../model/portal.model.ts";

/**
 * Member-facing resources: absent slots are simply not returned (never a broken link),
 * BOM only for hardware, links open in a new tab, files never expose storage paths.
 */
export function toResourceViews(
  projectId: string,
  type: ProjectType,
  records: readonly ResourceRecord[],
): ResourceView[] {
  const views: ResourceView[] = [];
  for (const record of records) {
    if (record.slot === "BOM" && type !== "HARDWARE") continue;
    if (record.source_type === "LINK" && record.url) {
      views.push({
        slot: record.slot,
        kind: "LINK",
        label: record.label,
        url: record.url,
        target: "_blank",
        rel: "noopener noreferrer",
      });
    } else if (record.source_type === "FILE" && record.file) {
      views.push({
        slot: record.slot,
        kind: "FILE",
        label: record.label,
        file: {
          id: record.file.id,
          filename: record.file.original_filename,
          content_type: record.file.content_type,
          size_bytes: record.file.size_bytes,
        },
        download_url_path: `/api/me/projects/${projectId}/files/${record.file.id}/download-url`,
      });
    }
  }
  return views.sort(
    (a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot),
  );
}
