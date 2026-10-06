import { DepartmentPill } from "@/features/members/components/DepartmentPill";
import type { Member } from "@/features/members/models/member";

const accentBar = {
  software: "bg-primary",
  hardware: "bg-amber",
} as const;

export function MemberCard({ member }: { member: Member }) {
  return (
    <article className="flex flex-col gap-[10px] rounded-[10px] border border-line bg-surface p-[18px]">
      <div
        aria-hidden="true"
        className={`h-[3px] rounded-[2px] ${member.department ? accentBar[member.department] : "bg-line"}`}
      />
      <h2 className="min-h-[26px] text-[17px] font-semibold text-ink">
        {member.fullName}
      </h2>
      <div className="flex min-h-7 items-center gap-[14px]">
        {member.department && <DepartmentPill department={member.department} />}
        {member.birthYear !== null && (
          <span className="text-xs font-medium text-muted">
            {member.birthYear}
          </span>
        )}
      </div>
      <hr className="border-line" />
      <p className="text-[10px] font-bold text-muted">EMAIL</p>
      <a
        href={`mailto:${member.email}`}
        className="truncate text-xs font-medium text-accent hover:underline"
      >
        {member.email}
      </a>
    </article>
  );
}
