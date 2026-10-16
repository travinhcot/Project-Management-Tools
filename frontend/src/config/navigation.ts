import type { DepartmentCode } from "@/config/departments";
import { isMemberRole, type AccountRole, type AdminRole } from "@/shared/auth/session";

export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: string;
  /** Admin roles that see this item; omitted means every admin role. The backend enforces it too. */
  readonly roles?: readonly AdminRole[];
  /** Departments that see this item; omitted means every department (and the super-admin). */
  readonly departments?: readonly DepartmentCode[];
}

const SUPER_ADMIN_ONLY = ["ADMIN"] as const;
const MARCOM_ONLY: readonly DepartmentCode[] = ["MARCOM"];

function inDepartment(item: NavItem, departmentCode: DepartmentCode | null | undefined): boolean {
  return !item.departments || (!!departmentCode && item.departments.includes(departmentCode));
}

export const workspaceNav: readonly NavItem[] = [
  { label: "Overview", href: "/overview", icon: "overview" },
  { label: "Projects", href: "/projects", icon: "projects" },
  { label: "Members", href: "/members", icon: "members" },
  { label: "Meeting emails", href: "/meeting-emails", icon: "meeting-emails" },
  { label: "Department resources", href: "/department-resources", icon: "department-resources", departments: MARCOM_ONLY },
  { label: "Semesters", href: "/semesters", icon: "semesters" },
  { label: "Users & access", href: "/users-access", icon: "users-access", roles: SUPER_ADMIN_ONLY },
  { label: "Audit log", href: "/audit-log", icon: "audit-log", roles: SUPER_ADMIN_ONLY },
];

/** Paths only the EB super-admin may open; a department admin is sent back to the overview. */
export const SUPER_ADMIN_PATHS: readonly string[] = workspaceNav
  .filter((item) => item.roles === SUPER_ADMIN_ONLY)
  .map((item) => item.href);

export function workspaceNavFor(
  role: AccountRole,
  departmentCode?: DepartmentCode | null,
): readonly NavItem[] {
  return workspaceNav.filter(
    (item) =>
      (!item.roles || (!isMemberRole(role) && item.roles.includes(role))) &&
      inDepartment(item, departmentCode),
  );
}

/** The member menu with Overview pointing at the member's own department dashboard. */
export function memberNavFor(
  dashboardPath: string | null,
  options: { overview?: boolean; departmentCode?: DepartmentCode | null } = {},
): readonly NavItem[] {
  const { overview = true, departmentCode } = options;
  return memberNav
    .filter((item) => overview || item.href !== "/member/overview")
    .filter((item) => inDepartment(item, departmentCode))
    .map((item) =>
      item.href === "/member/overview" && dashboardPath ? { ...item, href: dashboardPath } : item,
    );
}

export const memberNav: readonly NavItem[] = [
  { label: "Overview", href: "/member/overview", icon: "overview" },
  { label: "My projects", href: "/member/projects", icon: "projects" },
  { label: "Department resources", href: "/member/department-resources", icon: "department-resources", departments: MARCOM_ONLY },
  { label: "My profile", href: "/member/profile", icon: "members" },
];
