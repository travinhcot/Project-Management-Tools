import { Button } from "@/shared/components/Button";
import { Pill } from "@/shared/components/Pill";
import { USER_ROLES, type AppUser, type UserRole } from "@/features/users-access/models/user";

const ROLE_LABELS: Record<UserRole, string> = { ADMIN: "Admin", MEMBER: "Member" };

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
  onRoleChange: (user: AppUser, role: UserRole) => void;
  /** Called to activate, to start a deactivation, and to confirm one. */
  onToggleActive: (user: AppUser) => void;
  onCancelConfirm: () => void;
}) {
  return (
    <div className="overflow-x-auto rounded-[10px] border border-line bg-surface py-1.5">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="text-[11px] font-bold text-muted">
            <th scope="col" className="px-4 py-2.5 font-bold">USER</th>
            <th scope="col" className="w-[140px] py-2.5 pr-3 font-bold">ROLE</th>
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
                    value={user.role}
                    disabled={busy || isSelf}
                    title={isSelf ? "You cannot change your own role" : undefined}
                    onChange={(event) => onRoleChange(user, event.target.value as UserRole)}
                    className="h-[30px] rounded-lg border border-line bg-surface px-2 text-[13px] text-ink disabled:opacity-60"
                  >
                    {USER_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
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
