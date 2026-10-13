// Who is signed in, for server components (GET /api/auth/me). Server-only.
import { redirect } from "next/navigation";
import { backendFetch } from "@/shared/api/backend";
import { DEPARTMENT_LABELS, type DepartmentCode } from "@/config/departments";
import type { AccountRole } from "@/shared/auth/session";

export interface Viewer {
  id: string;
  role: AccountRole;
  fullName: string;
  /** Set only for a department admin. */
  departmentCode: DepartmentCode | null;
  departmentLabel: string | null;
}

export async function getViewer(): Promise<Viewer> {
  const { user } = await backendFetch<{
    user: {
      id: string;
      role: AccountRole;
      full_name: string;
      department_code: DepartmentCode | null;
    };
  }>("/api/auth/me");
  return {
    id: user.id,
    role: user.role,
    fullName: user.full_name,
    departmentCode: user.department_code,
    departmentLabel: user.department_code ? DEPARTMENT_LABELS[user.department_code] : null,
  };
}

/** For pages only the EB super-admin may open: a department admin goes back to the overview. */
export async function requireSuperAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (viewer.role !== "ADMIN") redirect("/overview");
  return viewer;
}
