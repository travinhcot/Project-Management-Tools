"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/shared/components/Button";
import { Drawer } from "@/shared/components/Drawer";
import { deleteMember, getDeleteImpact } from "@/features/members/actions";
import type { Member, MemberDeleteImpact } from "@/features/members/models/member";
import type { SemesterSummary } from "@/features/projects/models/project";

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** Permanent delete: shows what will be erased first; admin accounts are blocked. */
export function DeleteMemberDrawer({
  member,
  semester,
  onClose,
  onDeleted,
}: {
  member: Member;
  semester: SemesterSummary;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [impact, setImpact] = useState<MemberDeleteImpact>();
  const [error, setError] = useState<string>();
  const [pending, startDelete] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getDeleteImpact(member.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setImpact(result.impact);
      else setError(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, [member.id]);

  function handleDelete() {
    setError(undefined);
    startDelete(async () => {
      const result = await deleteMember(member.id);
      if (result.ok) onDeleted();
      else setError(result.message);
    });
  }

  const extraEntries = impact ? impact.rosterEntries - 1 : 0;

  return (
    <Drawer
      title={`Delete ${member.fullName}?`}
      subtitle={`${semester.label}  ·  ${member.email}`}
      onClose={onClose}
    >
      <div className="flex flex-wrap gap-2.5">
        <div className="flex flex-1 flex-col gap-0.5 rounded-[10px] bg-chrome p-3">
          <span className="text-[22px] font-bold text-danger">{impact ? impact.projects : "–"}</span>
          <span className="text-xs font-medium text-muted">
            {impact?.projects === 1 ? "project assignment" : "project assignments"}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-0.5 rounded-[10px] bg-chrome p-3">
          <span className="text-[22px] font-bold text-danger">
            {impact ? impact.deliveries : "–"}
          </span>
          <span className="text-xs font-medium text-muted">
            {impact?.deliveries === 1 ? "email record" : "email records"}
          </span>
        </div>
      </div>

      {impact && !impact.isAdmin && (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-xs text-ink">
          <li>
            Removes them from {plural(impact.projects, "project", "projects")} and erases{" "}
            {plural(impact.deliveries, "email delivery record", "email delivery records")}.
          </li>
          {impact.hasAccount ? (
            <li>
              Deletes their login account, so they can no longer sign in
              {extraEntries > 0 &&
                `. Their ${plural(extraEntries, "roster entry", "roster entries")} in other semesters are removed too`}
              .
            </li>
          ) : (
            <li>They have not signed in yet, so there is no login account to delete.</li>
          )}
        </ul>
      )}

      {impact?.isAdmin && (
        <p role="alert" className="rounded-[10px] bg-warn-soft p-3 text-xs font-medium text-warn-text">
          This person has an admin account and cannot be deleted here. Change their role in Users
          &amp; access first.
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}

      <p className="text-xs text-muted">
        This cannot be undone. To keep their history, set the member to inactive instead.
      </p>

      <div className="flex flex-wrap gap-2.5">
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={handleDelete}
          disabled={pending || !impact || impact.isAdmin}
        >
          {pending ? "Deleting…" : "Delete permanently"}
        </Button>
      </div>
    </Drawer>
  );
}
