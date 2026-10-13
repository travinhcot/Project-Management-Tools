import { Button } from "@/shared/components/Button";
import { Pill } from "@/shared/components/Pill";
import {
  ACTIVE_DEPARTMENTS,
  DEPARTMENT_CODES,
  DEPARTMENT_LABELS,
  type DepartmentCode,
} from "@/config/departments";
import type { AccessChange, AppUser } from "@/features/users-access/models/user";

/** One dropdown value per access level: super-admin, one admin per department, member. */
type AccessLevel = "ADMIN" | "MEMBER" | `DEPT_ADMIN:${DepartmentCode}`;

const ACCESS_LEVELS: { value: AccessLevel; label: string }[] = [
  { value: "ADMIN", label: "Admin (all departments)" },
  // HR has no workflow yet, so it has no admin option; an existing HR admin still shows as such.
  ...ACTIVE_DEPARTMENTS.map((code) => ({
    value: `DEPT_ADMIN:${code}` as AccessLevel,
    label: `${DEPARTMENT_LABELS[code]} admin`,
  })),
  { value: "MEMBER", label: "Member" },
];

function levelOf(user: AppUser): AccessLevel {
  return user.role === "DEPT_ADMIN" && user.departmentCode
    ? `DEPT_ADMIN:${user.departmentCode}`
    : (user.role as "ADMIN" | "MEMBER");
}

function changeFor(level: AccessLevel): AccessChange {
  if (level.startsWith("DEPT_ADMIN:")) {
    return { role: "DEPT_ADMIN", departmentCode: level.split(":")[1] as DepartmentCode };
  }
  return { role: level as "ADMIN" | "MEMBER" };
}

function formatSignIn(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function UsersTable({
  users,
  currentUserId,
  busyId,
  confirmingId,
  onRoleChange,
  onToggleActive,
  onCancelConfirm,
}: {
  users: AppUser[];
  currentUserId: string;
  /** User whose change is in flight; their controls are disabled. */
  busyId: string | null;
  /** User whose deactivation is awaiting confirmation. */
  confirmingId: string | null;
  onRoleChange: (user: AppUser, change: AccessChange) => void;
  /** Called to activate, to start a deactivation, and to confirm one. */
  onToggleActive: (user: AppUser) => void;
  onCancelConfirm: () => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-surface shadow-card py-1.5">
      <table className="w-full min-w-[860px] border-collapse text-left">
        <thead>
          <tr className="text-[11px] font-bold text-muted">
            <th scope="col" className="px-4 py-2.5 font-bold">USER</th>
            <th scope="col" className="w-[190px] py-2.5 pr-3 font-bold">ACCESS</th>
            <th scope="col" className="w-[130px] py-2.5 pr-3 font-bold">DEPARTMENT</th>
            <th scope="col" className="w-[110px] py-2.5 pr-3 font-bold">STATUS</th>
            <th scope="col" className="w-[130px] py-2.5 pr-3 font-bold">LAST SIGN-IN</th>
            <th scope="col" className="w-[190px] py-2.5 pr-4 font-bold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            const busy = busyId === user.id;
            const confirming = confirmingId === user.id;
            return (
              <tr key={user.id} className="border-t border-line/60">
                <th scope="row" className="px-4 py-3 text-left">
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-ink">
                      {user.fullName}
                      {isSelf && <span className="ml-2 text-xs font-medium text-muted">(you)</span>}
                    </span>
                    <span className="text-xs font-normal text-muted">{user.email}</span>
                  </span>
                </th>
                <td className="py-3 pr-3">
                  <select
                    aria-label={`Role for ${user.fullName}`}
                    value={levelOf(user)}
                    disabled={busy || isSelf}
                    title={isSelf ? "You cannot change your own role" : undefined}
                    onChange={(event) => onRoleChange(user, changeFor(event.target.value as AccessLevel))}
                    className="h-[30px] rounded-lg border border-line bg-surface px-2 text-[13px] text-ink disabled:opacity-60"
                  >
                    {ACCESS_LEVELS.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-3 pr-3">
                  {user.role === "ADMIN" || user.role === "DEPT_ADMIN" ? (
                    <span className="text-[13px] text-muted">
                      {user.departmentCode ? DEPARTMENT_LABELS[user.departmentCode] : "All departments"}
                    </span>
                  ) : (
                    <select
                      aria-label={`Department for ${user.fullName}`}
                      value={user.departmentCode ?? ""}
                      disabled={busy || isSelf}
                      onChange={(event) =>
                        onRoleChange(user, { departmentCode: event.target.value as DepartmentCode })
                      }
                      className="h-[30px] rounded-lg border border-line bg-surface px-2 text-[13px] text-ink disabled:opacity-60"
                    >
                      {DEPARTMENT_CODES.map((code) => (
                        <option key={code} value={code}>
                          {DEPARTMENT_LABELS[code]}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="py-3 pr-3">
                  <Pill tone={user.isActive ? "success" : "neutral"} size="sm">
                    {user.isActive ? "Active" : "Inactive"}
                  </Pill>
                </td>
                <td className="py-3 pr-3 text-[13px] text-ink">{formatSignIn(user.lastSignInAt)}</td>
                <td className="py-3 pr-4">
                  {confirming ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={busy}
                        onClick={() => onToggleActive(user)}
                        aria-label={`Confirm deactivating ${user.fullName}`}
                      >
                        Confirm
                      </Button>
                      <Button variant="outline" size="sm" disabled={busy} onClick={onCancelConfirm}>
                        Cancel
                      </Button>
                    </div>
                  ) : user.isActive ? (
                    <Button
                      variant="danger-outline"
                      size="sm"
                      disabled={busy || isSelf}
                      title={isSelf ? "You cannot deactivate your own account" : undefined}
                      onClick={() => onToggleActive(user)}
                      aria-label={`Deactivate ${user.fullName}`}
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      variant="link"
                      size="sm"
                      disabled={busy}
                      onClick={() => onToggleActive(user)}
                      aria-label={`Activate ${user.fullName}`}
                    >
                      Activate
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
