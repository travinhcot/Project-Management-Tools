/**
 * Account roles (app_users.role).
 *   ADMIN       EB super-admin: every department, users, audit log. No department.
 *   DEPT_ADMIN  admin of one department (app_users.department_id)
 *   MEMBER      a member of one department (app_users.department_id): the read-only member portal
 * Every account except ADMIN has a department_id; the database enforces it.
 */
export const MEMBER_ROLES = ["MEMBER"] as const;
export type MemberAccountRole = (typeof MEMBER_ROLES)[number];

export const ACCOUNT_ROLES = ["ADMIN", "DEPT_ADMIN", ...MEMBER_ROLES] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export function isMemberRole(role: string): role is MemberAccountRole {
  return (MEMBER_ROLES as readonly string[]).includes(role);
}
