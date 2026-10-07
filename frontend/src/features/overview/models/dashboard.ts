// UI shape for the overview page. Mapped from backend/src/modules/dashboard/model/dashboard.model.ts
// and the project list in dashboard.service.ts.

import type { ProjectType } from "@/shared/models/project";

export interface DashboardWarning {
  /** Backend warning code, e.g. PROJECTS_WITHOUT_MEMBERS. */
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  hint: string;
  link: string;
}

export interface DashboardProject {
  id: string;
  name: string;
  type: ProjectType;
  description: string | null;
  memberCount: number;
  kickoffAt: string | null;
}

export interface DashboardSemester {
  id: string;
  name: string;
  isCurrent: boolean;
}

/** `semester` is null when no semester exists at all. */
export interface Dashboard {
  semester: DashboardSemester | null;
  /** Every semester, newest first, for the switcher. */
  semesters: DashboardSemester[];
  roster: { active: number };
  projects: { software: number; hardware: number; total: number };
  /** Warnings are only computed for the current semester; empty for past ones. */
  warnings: DashboardWarning[];
  recentProjects: DashboardProject[];
}
