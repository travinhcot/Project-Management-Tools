"use client";

import { useState } from "react";
import { Button } from "@/shared/components/Button";
import { Drawer } from "@/shared/components/Drawer";
import { projectTypeMeta } from "@/shared/components/ProjectTypePill";
import type {
  Project,
  SemesterSummary,
} from "@/features/projects/models/project";
import { formatKickoff } from "@/features/projects/utils/format";

export function ArchiveProjectDrawer({
  project,
  semester,
  onClose,
  onConfirm,
}: {
  project: Project;
  semester: SemesterSummary;
  onClose: () => void;
  onConfirm: (options: { cancelKickoff: boolean }) => void;
}) {
  const [kickoffPending] = useState(
    () => project.kickoffAt !== null && Date.parse(project.kickoffAt) > Date.now(),
  );
  const [cancelKickoff, setCancelKickoff] = useState(true);
  const memberLabel = project.memberCount === 1 ? "member" : "members";

  return (
    <Drawer
      title={`Archive ${project.name}?`}
      subtitle={`${semester.label}  ·  ${projectTypeMeta[project.type].label}`}
      onClose={onClose}
    >
      <div className="flex gap-2.5">
        <div className="flex flex-1 flex-col gap-0.5 rounded-[10px] bg-chrome p-3">
          <span className="text-[22px] font-bold text-danger">
            {project.memberCount}
          </span>
          <span className="text-xs font-medium text-muted">
            {project.memberCount === 1
              ? "member loses access"
              : "members lose access"}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-0.5 rounded-[10px] bg-chrome p-3">
          <span className="text-[22px] font-bold text-warn-text">
            {kickoffPending ? 1 : 0}
          </span>
          <span className="text-xs font-medium text-muted">
            kick-off email scheduled
          </span>
        </div>
      </div>

      {kickoffPending && project.kickoffAt && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-warn-line bg-warn-soft p-3">
          <input
            type="checkbox"
            checked={cancelKickoff}
            onChange={(event) => setCancelKickoff(event.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="flex size-[18px] shrink-0 items-center justify-center rounded bg-line text-[11px] font-bold text-transparent peer-checked:bg-primary peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
          >
            ✓
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-ink">
              Also cancel the kick-off email
            </span>
            <span className="text-xs text-muted">
              Scheduled for {formatKickoff(project.kickoffAt)} to{" "}
              {project.memberCount} {memberLabel}
            </span>
          </span>
        </label>
      )}

      <p className="text-xs text-muted">
        Files and links are kept. Audit history is kept. Unarchive restores
        member access.
      </p>

      <div className="flex gap-2.5">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={() =>
            onConfirm({ cancelKickoff: kickoffPending && cancelKickoff })
          }
        >
          Archive project
        </Button>
      </div>
    </Drawer>
  );
}
