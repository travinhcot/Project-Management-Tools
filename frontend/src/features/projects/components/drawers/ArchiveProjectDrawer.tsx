"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/shared/components/Button";
import { Drawer } from "@/shared/components/Drawer";
import { projectTypeMeta } from "@/shared/components/ProjectTypePill";
import { getArchiveImpact, type ActionResult } from "@/features/projects/actions";
import type {
  Project,
  ProjectArchiveImpact,
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
  onConfirm: (options: { cancelKickoff: boolean }) => Promise<ActionResult>;
}) {
  const [impact, setImpact] = useState<ProjectArchiveImpact>();
  const [error, setError] = useState<string>();
  const [cancelKickoff, setCancelKickoff] = useState(true);
  const [pending, startArchive] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getArchiveImpact(project.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setImpact(result.impact);
      else setError(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  const kickoffPending = impact?.pendingKickoffAt != null;
  const members = impact?.activeMembers ?? 0;
  const memberLabel = members === 1 ? "member" : "members";

  function handleConfirm() {
    setError(undefined);
    startArchive(async () => {
      const result = await onConfirm({ cancelKickoff: kickoffPending && cancelKickoff });
      if (result.ok) onClose();
      else setError(result.message);
    });
  }

  return (
    <Drawer
      title={`Archive ${project.name}?`}
      subtitle={`${semester.label}  ·  ${projectTypeMeta[project.type].label}`}
      onClose={onClose}
    >
      <div className="flex gap-2.5">
        <div className="flex flex-1 flex-col gap-0.5 rounded-[10px] bg-chrome p-3">
          <span className="text-[22px] font-bold text-danger">
            {impact ? members : "–"}
          </span>
          <span className="text-xs font-medium text-muted">
            {members === 1 ? "member loses access" : "members lose access"}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-0.5 rounded-[10px] bg-chrome p-3">
          <span className="text-[22px] font-bold text-warn-text">
            {impact ? (kickoffPending ? 1 : 0) : "–"}
          </span>
          <span className="text-xs font-medium text-muted">
            kick-off email scheduled
          </span>
        </div>
      </div>

      {kickoffPending && impact?.pendingKickoffAt && (
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
              Scheduled for {formatKickoff(impact.pendingKickoffAt)} to {members}{" "}
              {memberLabel}
            </span>
          </span>
        </label>
      )}

      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}

      <p className="text-xs text-muted">
        Files and links are kept. Audit history is kept. Unarchive restores
        member access.
      </p>

      <div className="flex gap-2.5">
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={handleConfirm}
          disabled={pending || !impact}
        >
          {pending ? "Archiving…" : "Archive project"}
        </Button>
      </div>
    </Drawer>
  );
}
