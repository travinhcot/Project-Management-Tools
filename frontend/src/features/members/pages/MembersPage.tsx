"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/shared/components/Button";
import { SemesterBadge } from "@/shared/components/SemesterBadge";
import { ImportRosterModal } from "@/features/members/components/import/ImportRosterModal";
import { MemberCard } from "@/features/members/components/MemberCard";
import { MembersToolbar } from "@/features/members/components/MembersToolbar";
import type { MemberFilters, MemberListPage } from "@/features/members/models/member";

// Filters live in the URL and the list is fetched by the server component; committing an
// import revalidates the route, so this page keeps no copy of the members.
export function MembersPage({
  list,
  filters,
}: {
  list: MemberListPage;
  filters: MemberFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { semester, items: members } = list;
  const [search, setSearch] = useState(filters.search);
  const [importing, setImporting] = useState(false);

  function navigate(next: Partial<MemberFilters>) {
    const merged = { ...filters, page: 1, ...next };
    const params = new URLSearchParams();
    if (merged.search) params.set("q", merged.search);
    if (merged.status !== "active") params.set("status", merged.status);
    if (merged.page > 1) params.set("page", String(merged.page));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  // Debounce typing into the URL; skip when the box already matches it.
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === filters.search) return;
    const timer = setTimeout(() => navigate({ search: trimmed }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const pageCount = Math.max(1, Math.ceil(list.total / list.size));
  const hasFilters = filters.search !== "" || filters.status !== "active";

  return (
    <div className="flex flex-col gap-[22px]">
      <p className="whitespace-pre-wrap break-words text-[13px] font-medium text-muted">
        {"Workspace  /  Project Management  /  Members"}
      </p>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-bold sm:text-[30px] text-ink">Members</h1>
          <p className="text-sm text-muted">
            {semester
              ? `Browse the ${semester.name} roster and member contact details.`
              : "Browse the roster and member contact details."}
          </p>
        </div>
        {semester && <SemesterBadge name={semester.name} active={semester.active} />}
      </div>

      {!semester ? (
        <section className="flex flex-col items-start gap-2 rounded-[10px] border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold text-ink">No current semester</h2>
          <p className="text-[13px] text-muted">
            Set a current semester to see and import its roster.
          </p>
          <Link href="/semesters" className="text-[13px] font-semibold text-accent">
            Go to semesters →
          </Link>
        </section>
      ) : (
        <>
          <MembersToolbar
            query={search}
            onQueryChange={setSearch}
            status={filters.status}
            onStatusChange={(value) => navigate({ status: value as MemberFilters["status"] })}
            onImport={() => setImporting(true)}
          />

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p className="text-sm font-semibold text-ink" aria-live="polite">
              {list.total} {list.total === 1 ? "member" : "members"}
            </p>
            <p className="text-xs font-medium text-muted">{semester.name}</p>
          </div>

          {members.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((member) => (
                <MemberCard key={member.id} member={member} />
              ))}
            </div>
          ) : (
            <div className="rounded-[10px] border border-line bg-surface p-8 text-center">
              <p className="text-[15px] font-semibold text-ink">
                {hasFilters ? "No members match your filters" : "No members yet"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {hasFilters
                  ? "Try a different name, email or status."
                  : "Import a roster CSV to add members."}
              </p>
            </div>
          )}

          {pageCount > 1 && (
            <nav
              aria-label="Pagination"
              className="flex flex-wrap items-center justify-between gap-3 sm:justify-end"
            >
              <span className="mr-auto text-xs text-muted sm:mr-0">
                Page {list.page} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={list.page <= 1}
                onClick={() => navigate({ page: list.page - 1 })}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={list.page >= pageCount}
                onClick={() => navigate({ page: list.page + 1 })}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}

      {semester && importing && (
        <ImportRosterModal semester={semester} onClose={() => setImporting(false)} />
      )}
    </div>
  );
}
