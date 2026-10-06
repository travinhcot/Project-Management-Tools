"use client";

import { useMemo, useState } from "react";
import { SemesterBadge } from "@/shared/components/SemesterBadge";
import { ImportRosterModal } from "@/features/members/components/import/ImportRosterModal";
import { MemberCard } from "@/features/members/components/MemberCard";
import { MembersToolbar } from "@/features/members/components/MembersToolbar";
import type { Member } from "@/features/members/models/member";
import type { SemesterSummary } from "@/features/projects/models/project";
import { normalizeText } from "@/features/projects/utils/format";

export function MembersPage({
  semester,
  initialMembers,
}: {
  semester: SemesterSummary;
  initialMembers: Member[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [importing, setImporting] = useState(false);

  // A member is an active roster entry; deactivated ones drop out of the grid.
  const visible = useMemo(() => {
    const needle = normalizeText(query.trim());
    return members.filter((member) => {
      if (member.status !== "active") return false;
      if (department !== "all" && member.department !== department) return false;
      if (!needle) return true;
      return normalizeText(`${member.fullName} ${member.email}`).includes(needle);
    });
  }, [members, query, department]);

  return (
    <div className="flex flex-col gap-[22px]">
      <p className="whitespace-pre text-[13px] font-medium text-muted">
        {"Workspace  /  Project Management  /  Members"}
      </p>

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[30px] font-bold text-ink">Members</h1>
          <p className="text-sm text-muted">
            Browse the {semester.name} roster and member contact details.
          </p>
        </div>
        <SemesterBadge name={semester.name} active={semester.active} />
      </div>

      <MembersToolbar
        query={query}
        onQueryChange={setQuery}
        department={department}
        onDepartmentChange={setDepartment}
        onImport={() => setImporting(true)}
      />

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-ink" aria-live="polite">
          {visible.length} {visible.length === 1 ? "member" : "members"}
        </p>
        <p className="text-xs font-medium text-muted">{semester.name}</p>
      </div>

      {visible.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      ) : (
        <div className="rounded-[10px] border border-line bg-surface p-8 text-center">
          <p className="text-[15px] font-semibold text-ink">
            No members match your filters
          </p>
          <p className="mt-1 text-xs text-muted">
            Try a different name, email or department.
          </p>
        </div>
      )}

      {importing && (
        <ImportRosterModal
          semester={semester}
          members={members}
          onClose={() => setImporting(false)}
          onCommit={setMembers}
        />
      )}
    </div>
  );
}
