// Mirrors DEPARTMENT_CODES in backend/src/modules/users/model/user.model.ts.
export const DEPARTMENT_CODES = ["TECH", "MARCOM", "HR"] as const;
export type DepartmentCode = (typeof DEPARTMENT_CODES)[number];

import type { AccountRole } from "@/shared/auth/session";
import type { ProjectType } from "@/shared/models/project";

export const DEPARTMENT_LABELS: Record<DepartmentCode, string> = {
  TECH: "Tech",
  MARCOM: "Marcom",
  HR: "HR",
};

/** Top-bar workspace name of a department admin. */
export const DEPARTMENT_WORKSPACE_LABELS: Record<DepartmentCode, string> = {
  TECH: "Tech Workspace",
  MARCOM: "Marketing & Communication Workspace",
  HR: "HR Workspace",
};

/** Mirrors DEPARTMENT_PROJECT_TYPES in backend/src/shared/resource-rules.ts. */
export const DEPARTMENT_PROJECT_TYPES: Record<DepartmentCode, readonly ProjectType[]> = {
  TECH: ["software", "hardware", "research"],
  MARCOM: ["event", "content"],
  HR: [],
};

/** The department a project type belongs to (what the super-admin's create request names). */
export function departmentOfType(type: ProjectType): DepartmentCode {
  return (DEPARTMENT_CODES.find((code) => DEPARTMENT_PROJECT_TYPES[code].includes(type)) ??
    "TECH") as DepartmentCode;
}

/** Departments that have a workflow built; HR has none yet, so it is not offered anywhere. */
export const ACTIVE_DEPARTMENTS: readonly DepartmentCode[] = ["TECH", "MARCOM"];

/** Departments whose members have no overview: they work from My projects and Department resources. */
const DEPARTMENTS_WITHOUT_MEMBER_OVERVIEW: readonly DepartmentCode[] = ["MARCOM"];

export function hasMemberOverview(code: DepartmentCode | null): boolean {
  return !(code && DEPARTMENTS_WITHOUT_MEMBER_OVERVIEW.includes(code));
}

/** A member's own dashboard: /member/tech. Null when the department has none. */
export function memberDashboardPath(code: DepartmentCode | null): string | null {
  return code && ACTIVE_DEPARTMENTS.includes(code) && hasMemberOverview(code)
    ? `/member/${code.toLowerCase()}`
    : null;
}

/** Project types a viewer can create: their department's, or all of them for the super-admin. */
export function creatableTypes(viewer: {
  role: AccountRole;
  departmentCode: DepartmentCode | null;
}): readonly ProjectType[] {
  if (viewer.role === "DEPT_ADMIN" && viewer.departmentCode)
    return DEPARTMENT_PROJECT_TYPES[viewer.departmentCode];
  return ACTIVE_DEPARTMENTS.flatMap((code) => DEPARTMENT_PROJECT_TYPES[code]);
}
