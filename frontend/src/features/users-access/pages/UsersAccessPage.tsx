"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/shared/components/Button";
import { SelectBox } from "@/shared/components/Field";
import { updateUserAccess } from "@/features/users-access/actions";
import { UsersTable } from "@/features/users-access/components/UsersTable";
import type {
  AppUser,
  UserFilters,
  UserListPage,
  UserRole,
} from "@/features/users-access/models/user";

const ROLE_OPTIONS = [
  { value: "all", label: "All roles" },
  { value: "ADMIN", label: "Admins" },
  { value: "MEMBER", label: "Members" },
] as const;

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

// Filters live in the URL and the list is fetched by the server component; every action
// revalidates the route, so this page keeps no copy of the users.
export function UsersAccessPage({
  list,
  filters,
  currentUserId,
}: {
  list: UserListPage;
  filters: UserFilters;
  currentUserId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(filters.search);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [, startChange] = useTransition();

  function navigate(next: Partial<UserFilters>) {
    const merged = { ...filters, page: 1, ...next };
    const params = new URLSearchParams();
    if (merged.search) params.set("q", merged.search);
    if (merged.role !== "all") params.set("role", merged.role);
    if (merged.status !== "all") params.set("status", merged.status);
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

  function change(user: AppUser, update: { role?: UserRole; isActive?: boolean }) {
    setError(undefined);
    setConfirmingId(null);
    setBusyId(user.id);
    startChange(async () => {
      const result = await updateUserAccess(user.id, update);
      if (!result.ok) setError(result.message);
      setBusyId(null);
    });
  }

  function toggleActive(user: AppUser) {
    if (user.isActive && confirmingId !== user.id) {
      setConfirmingId(user.id);
      return;
    }
    change(user, { isActive: !user.isActive });
  }

  const pageCount = Math.max(1, Math.ceil(list.total / list.size));
  const hasFilters = filters.search || filters.role !== "all" || filters.status !== "all";

  return (
    <div className="flex flex-col gap-[22px]">
      <p className="whitespace-pre-wrap break-words text-[13px] font-medium text-muted">
        {"Workspace  /  Project Management  /  Users & access"}
      </p>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-[30px] text-ink">Users & access</h1>
        <p className="text-sm text-muted">
          Choose who is an admin and who can sign in. Deactivated users lose access immediately.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-[10px] border border-danger-line bg-danger-soft px-4 py-3 text-[13px] text-ink"
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

      <div className="flex flex-wrap items-center gap-[14px]">
        <label className="flex h-11 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-muted focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 sm:w-[420px]">
          <span aria-hidden="true" className="text-xl leading-none">⌕</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users by name or email"
            aria-label="Search users by name or email"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
          />
        </label>
        <SelectBox
          label="Filter by role"
          value={filters.role}
          onChange={(value) => navigate({ role: value as UserFilters["role"] })}
          options={ROLE_OPTIONS}
          className="h-11 w-full sm:w-[150px]"
        />
        <SelectBox
          label="Filter by status"
          value={filters.status}
          onChange={(value) => navigate({ status: value as UserFilters["status"] })}
          options={STATUS_OPTIONS}
          className="h-11 w-full sm:w-[160px]"
        />
      </div>

      <p className="text-sm font-semibold text-ink" aria-live="polite">
        {list.total} {list.total === 1 ? "user" : "users"}
      </p>

      {list.users.length === 0 ? (
        <div className="rounded-[10px] border border-line bg-surface p-8 text-center text-[13px] text-muted">
          {hasFilters ? "No users match these filters." : "No users yet."}
        </div>
      ) : (
        <UsersTable
          users={list.users}
          currentUserId={currentUserId}
          busyId={busyId}
          confirmingId={confirmingId}
          onRoleChange={(user, role) => change(user, { role })}
          onToggleActive={toggleActive}
          onCancelConfirm={() => setConfirmingId(null)}
        />
      )}

      {pageCount > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-end gap-3">
          <span className="text-xs text-muted">
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
    </div>
  );
}
