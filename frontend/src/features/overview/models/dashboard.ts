// Shapes mirror backend/src/modules/dashboard/model/dashboard.model.ts.

export type ProjectType = "software" | "hardware";

export interface DashboardWarning {
  id: string;
  message: string;
  hint: string;
  link: string;
}

export interface DashboardProject {
  id: string;
  name: string;
  type: ProjectType;
  description: string;
  memberCount: number;
  kickoffAt: string;
}

export interface Dashboard {
  semester: { id: string; name: string; active: boolean };
  roster: { active: number };
  projects: { software: number; hardware: number; total: number };
  warnings: DashboardWarning[];
  recentProjects: DashboardProject[];
}
