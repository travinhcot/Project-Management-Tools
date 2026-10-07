// Reads the overview from the backend: GET /api/admin/dashboard for the stats and warnings,
// GET /api/admin/projects for the project cards. Server-only (goes through backendFetch).
import { backendFetch } from "@/shared/api/backend";
import { getSemesters } from "@/features/semesters/service/semesters.service";
import type {
  Dashboard,
  DashboardProject,
  DashboardSemester,
  DashboardWarning,
} from "@/features/overview/models/dashboard";

/** DashboardSummary in backend/src/modules/dashboard/model/dashboard.model.ts. */
interface DashboardDto {
  semester: { id: string; name: string } | null;
  empty: boolean;
  metrics: {
    roster: { active: number };
    projects: { software: number; hardware: number; research?: number; total: number };
  } | null;
  warnings: {
    code: string;
    severity: "info" | "warning" | "error";
    message: string;
    count: number;
    link: string;
    items: { name?: string }[];
  }[];
}

/** ProjectListItem in backend/src/modules/projects/model/project.model.ts (fields used here). */
interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  type: "SOFTWARE" | "HARDWARE" | "RESEARCH";
  member_count: number;
  kickoff: { scheduled_at: string | null } | null;
}

const RECENT_PROJECT_COUNT = 3;

// Backend links use the /admin/* prefix; the frontend routes differ and have no detail pages.
function mapLink(link: string): string {
  const path = link.split("?")[0];
  if (path.startsWith("/admin/roster")) return "/members";
  if (path.startsWith("/admin/campaigns")) return "/meeting-emails";
  if (path.startsWith("/admin/projects")) return "/projects";
  return "/overview";
}

function mapWarning(dto: DashboardDto["warnings"][number]): DashboardWarning {
  const names = dto.items.map((item) => item.name).filter(Boolean) as string[];
  const hint =
    names.length > 0
      ? names.slice(0, 3).join(", ") +
        (dto.count > 3 ? ` +${dto.count - 3} more` : "")
      : `${dto.count} affected`;
  return {
    id: dto.code,
    severity: dto.severity,
    message: dto.message,
    hint,
    link: mapLink(dto.link),
  };
}

function mapProject(dto: ProjectDto): DashboardProject {
  return {
    id: dto.id,
    name: dto.name,
    type: dto.type.toLowerCase() as DashboardProject["type"],
    description: dto.description,
    memberCount: dto.member_count,
    kickoffAt: dto.kickoff?.scheduled_at ?? null,
  };
}

export async function getDashboard(
  requestedSemesterId?: string,
): Promise<Dashboard> {
  const { semesters: all } = await getSemesters();
  const semesters: DashboardSemester[] = [...all]
    .sort((a, b) => b.year - a.year || b.term.localeCompare(a.term))
    .map((s) => ({ id: s.id, name: s.name, isCurrent: s.isCurrent }));
  const selected =
    semesters.find((s) => s.id === requestedSemesterId) ??
    semesters.find((s) => s.isCurrent) ??
    null;

  // The dashboard summary (stats + warnings) only covers the current semester.
  if (selected?.isCurrent || !selected) {
    const [summary, projects] = await Promise.all([
      backendFetch<DashboardDto>("/api/admin/dashboard"),
      backendFetch<{ items: ProjectDto[] }>(
        `/api/admin/projects?size=${RECENT_PROJECT_COUNT}`,
      ),
    ]);
    return {
      semester: selected,
      semesters,
      roster: { active: summary.metrics?.roster.active ?? 0 },
      projects: {
        software: summary.metrics?.projects.software ?? 0,
        hardware: summary.metrics?.projects.hardware ?? 0,
        research: summary.metrics?.projects.research ?? 0,
        total: summary.metrics?.projects.total ?? 0,
      },
      warnings: summary.warnings.map(mapWarning),
      recentProjects: projects.items.map(mapProject),
    };
  }

  // Past/upcoming semester: derive stats from the semester and its project list.
  const { items } = await backendFetch<{ items: ProjectDto[] }>(
    `/api/admin/projects?semesterId=${selected.id}&size=100`,
  );
  const count = (type: ProjectDto["type"]) => items.filter((p) => p.type === type).length;
  return {
    semester: selected,
    semesters,
    roster: {
      active: all.find((s) => s.id === selected.id)?.rosterCount ?? 0,
    },
    projects: {
      software: count("SOFTWARE"),
      hardware: count("HARDWARE"),
      research: count("RESEARCH"),
      total: items.length,
    },
    warnings: [],
    recentProjects: items.slice(0, RECENT_PROJECT_COUNT).map(mapProject),
  };
}
