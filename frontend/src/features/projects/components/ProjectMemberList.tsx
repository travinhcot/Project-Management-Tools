"use client";

import { useEffect, useState } from "react";
import { Pill } from "@/shared/components/Pill";
import { getProjectMembers } from "@/features/projects/actions";
import type { ProjectMember } from "@/features/projects/models/project";

const PREVIEW_COUNT = 4;

/** Member names of one project, loaded with its row and reloaded if the count changes. */
export function ProjectMemberList({
  projectId,
  memberCount,
}: {
  projectId: string;
  memberCount: number;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; members: ProjectMember[] }
  >({ status: "loading" });

  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getProjectMembers(projectId).then((result) => {
      if (cancelled) return;
      setState(
        result.ok
          ? { status: "ready", members: result.members }
          : { status: "error", message: result.message },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, memberCount]);

  if (state.status === "loading") {
    return (
      <p aria-live="polite" className="text-[13px] text-muted">
        Loading members…
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="text-[13px] text-danger">
        {state.message}
      </p>
    );
  }
  if (state.members.length === 0) {
    return <p className="text-[13px] text-muted">No members yet.</p>;
  }
  const { members } = state;
  const visible = showAll ? members : members.slice(0, PREVIEW_COUNT);
  const hidden = members.length - visible.length;
  return (
    <div className="flex w-full flex-col gap-1.5">
      <ul className="flex w-full flex-col gap-1.5">
        {visible.map((member) => (
          <li
            key={member.rosterMemberId}
            className="flex items-center justify-between gap-2 text-[13px] text-ink"
          >
            <span className="min-w-0 truncate">{member.fullName}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              {!member.active && (
                <Pill tone="warn" size="sm">
                  Inactive
                </Pill>
              )}
              {member.role === "LEADER" && (
                <Pill tone="accent" size="sm">
                  Leader
                </Pill>
              )}
            </span>
          </li>
        ))}
      </ul>
      {members.length > PREVIEW_COUNT && (
        <button
          type="button"
          aria-expanded={showAll}
          onClick={() => setShowAll((open) => !open)}
          className="self-start rounded text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {showAll ? "Show less" : `Show ${hidden} more`}
        </button>
      )}
    </div>
  );
}
