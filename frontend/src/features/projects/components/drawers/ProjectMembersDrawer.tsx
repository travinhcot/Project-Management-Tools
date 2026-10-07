"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/shared/components/Button";
import { Drawer } from "@/shared/components/Drawer";
import { Pill } from "@/shared/components/Pill";
import {
  addProjectMember,
  getProjectMembers,
  removeProjectMember,
  searchRoster,
  setProjectMemberRole,
  type ActionResult,
} from "@/features/projects/actions";
import type {
  MemberRole,
  Project,
  ProjectMember,
  RosterCandidate,
  SemesterSummary,
} from "@/features/projects/models/project";

/** Add or remove the people assigned to a project, and choose its leader. */
export function ProjectMembersDrawer({
  project,
  semester,
  onClose,
}: {
  project: Pick<Project, "id" | "name" | "semesterId">;
  semester: SemesterSummary;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<ProjectMember[]>();
  const [candidates, setCandidates] = useState<RosterCandidate[]>([]);
  const [search, setSearch] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [, startChange] = useTransition();

  const loadMembers = useCallback(async () => {
    const result = await getProjectMembers(project.id);
    if (result.ok) setMembers(result.members);
    else setError(result.message);
  }, [project.id]);

  useEffect(() => {
    let cancelled = false;
    getProjectMembers(project.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setMembers(result.members);
      else setError(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  // Debounced roster search; empty text lists the first active entries.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await searchRoster(project.semesterId, search.trim());
      if (cancelled) return;
      if (result.ok) setCandidates(result.candidates);
      else setError(result.message);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [project.semesterId, search]);

  function change(rosterMemberId: string, work: () => Promise<ActionResult>) {
    setError(undefined);
    setConfirmingId(null);
    setBusyId(rosterMemberId);
    startChange(async () => {
      const result = await work();
      if (!result.ok) setError(result.message);
      await loadMembers();
      setBusyId(null);
    });
  }

  const assignedIds = new Set(members?.map((member) => member.rosterMemberId));
  const available = candidates.filter((candidate) => !assignedIds.has(candidate.id));

  return (
    <Drawer
      title="Add / remove members"
      subtitle={`${project.name}  ·  ${semester.label}`}
      onClose={onClose}
    >
      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-[10px] border border-danger-line bg-danger-soft px-3 py-2.5 text-[13px] text-ink"
        >
          <span>{error}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setError(undefined)}
            className="text-lg leading-none text-muted hover:text-ink"
          >
            ×
          </button>
        </div>
      )}

      <section className="flex flex-col gap-2" aria-label="Current members">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">Current members</h3>
          <span className="text-xs font-medium text-muted" aria-live="polite">
            {members ? members.length : "–"}
          </span>
        </div>
        {!members ? (
          <p className="text-[13px] text-muted">Loading…</p>
        ) : members.length === 0 ? (
          <p className="rounded-[10px] bg-chrome p-3 text-[13px] text-muted">
            No members yet. Add people from the roster below.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {members.map((member) => {
              const busy = busyId === member.rosterMemberId;
              const nextRole: MemberRole = member.role === "LEADER" ? "MEMBER" : "LEADER";
              return (
                <li
                  key={member.rosterMemberId}
                  className="flex flex-col gap-2 rounded-[10px] bg-chrome p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[13px] font-semibold text-ink">
                        {member.fullName}
                      </span>
                      <span className="truncate text-xs text-muted">{member.email}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {!member.active && <Pill tone="warn" size="sm">Inactive</Pill>}
                      <Pill tone={member.role === "LEADER" ? "accent" : "neutral"} size="sm">
                        {member.role === "LEADER" ? "Leader" : "Member"}
                      </Pill>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        change(member.rosterMemberId, () =>
                          setProjectMemberRole(project.id, member.rosterMemberId, nextRole),
                        )
                      }
                    >
                      {member.role === "LEADER" ? "Make member" : "Make leader"}
                    </Button>
                    {confirmingId === member.rosterMemberId ? (
                      <>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            change(member.rosterMemberId, () =>
                              removeProjectMember(project.id, member.rosterMemberId),
                            )
                          }
                        >
                          Confirm remove
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setConfirmingId(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="danger-outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => setConfirmingId(member.rosterMemberId)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-label="Add from roster">
        <h3 className="text-sm font-bold text-ink">Add from {semester.label} roster</h3>
        <label className="flex h-11 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-muted focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <span aria-hidden="true" className="text-xl leading-none">
            ⌕
          </span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search roster by name or email"
            aria-label="Search roster by name or email"
            className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted sm:text-[13px]"
          />
        </label>
        {available.length === 0 ? (
          <p className="rounded-[10px] bg-chrome p-3 text-[13px] text-muted">
            {search.trim()
              ? "No unassigned active roster members match."
              : "Every active roster member shown is already assigned."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {available.map((candidate) => (
              <li
                key={candidate.id}
                className="flex items-center justify-between gap-3 rounded-[10px] border border-line bg-surface p-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[13px] font-semibold text-ink">
                    {candidate.fullName}
                  </span>
                  <span className="truncate text-xs text-muted">
                    {candidate.email}
                  </span>
                </div>
                <Button
                  variant="link"
                  size="sm"
                  disabled={busyId === candidate.id}
                  onClick={() =>
                    change(candidate.id, () => addProjectMember(project.id, candidate.id))
                  }
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button variant="outline" onClick={onClose}>
        Done
      </Button>
    </Drawer>
  );
}
