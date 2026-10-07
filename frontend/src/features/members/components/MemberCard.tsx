import { Button } from "@/shared/components/Button";
import type { Member } from "@/features/members/models/member";

export function MemberCard({
  member,
  onDelete,
}: {
  member: Member;
  onDelete: () => void;
}) {
  return (
    <article className="flex flex-col gap-[10px] rounded-[10px] border border-line bg-surface p-[18px]">
      <div aria-hidden="true" className="h-[3px] rounded-[2px] bg-primary" />
      <h2 className="min-h-[26px] break-words text-[17px] font-semibold text-ink">
        {member.fullName}
      </h2>
      <div className="flex min-w-0 flex-col gap-[10px]">
        <p className="text-[10px] font-bold text-muted">MAJOR</p>
        <p
          className={`break-words text-xs font-medium ${member.major ? "text-ink" : "text-placeholder"}`}
        >
          {member.major ?? "—"}
        </p>
      </div>
      <hr className="border-line" />
      <p className="text-[10px] font-bold text-muted">EMAIL</p>
      <a
        href={`mailto:${member.email}`}
        className="truncate text-xs font-medium text-accent hover:underline"
      >
        {member.email}
      </a>
      <Button
        variant="danger-outline"
        size="sm"
        onClick={onDelete}
        aria-label={`Delete ${member.fullName} permanently`}
        className="mt-1 self-start"
      >
        Delete
      </Button>
    </article>
  );
}
