import Link from "next/link";
import { Pill } from "@/shared/components/Pill";

/** Breadcrumb, page title and the semester pills shared by every member page. */
export function MemberPageHeader({
  breadcrumb,
  title,
  subtitle,
  semesterName,
  back,
}: {
  breadcrumb: string;
  title: string;
  subtitle: string;
  semesterName?: string | null;
  back?: { href: string; label: string };
}) {
  return (
    <>
      <p className="whitespace-pre-wrap break-words text-[13px] font-medium text-muted">
        {breadcrumb}
      </p>
      {back && (
        <Link href={back.href} className="text-[13px] font-semibold text-accent">
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="break-words text-2xl font-bold text-ink sm:text-[30px]">{title}</h1>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        {semesterName && (
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="surface">{semesterName}</Pill>
            <Pill tone="success">● Active</Pill>
          </div>
        )}
      </div>
    </>
  );
}
