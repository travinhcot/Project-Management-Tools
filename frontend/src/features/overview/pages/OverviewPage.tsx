import Link from "next/link";
import { AttentionCard } from "@/features/overview/components/AttentionCard";
import { ProjectCard } from "@/features/overview/components/ProjectCard";
import { StatCard } from "@/features/overview/components/StatCard";
import { SemesterSwitcher } from "@/shared/components/SemesterSwitcher";
import { getViewer } from "@/shared/auth/viewer";
import { getDashboard } from "@/features/overview/service/dashboard.service";

export async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ semester?: string | string[] }>;
}) {
  const { semester: semesterParam } = await searchParams;
  const viewer = await getViewer();
  const marcom = viewer.role === "DEPT_ADMIN" && viewer.departmentCode === "MARCOM";
  const dashboard = await getDashboard(
    typeof semesterParam === "string" ? semesterParam : undefined,
  );
  const { semester, semesters, roster, projects, warnings, recentProjects } =
    dashboard;

  return (
    <div className="flex flex-col gap-[22px]">
      <p className="whitespace-pre-wrap break-words text-[13px] font-medium text-muted">
        {"Workspace  /  Project Management"}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold sm:text-[30px] text-ink">Project Management</h1>
          <p className="text-sm text-muted">
            {marcom
              ? "A clear view of this semester’s Marcom people, projects and content prep."
              : "A clear view of this semester’s people and projects."}
          </p>
        </div>
        {semester && (
          <SemesterSwitcher options={semesters} selectedId={semester.id} basePath="/overview" />
        )}
      </div>

      {!semester && (
        <section className="flex flex-col items-start gap-2 rounded-2xl bg-surface shadow-card p-5">
          <h2 className="text-lg font-semibold text-ink">No current semester</h2>
          <p className="text-[13px] text-muted">
            Set a current semester to see roster and project stats.
          </p>
          <Link
            href="/semesters"
            className="text-[13px] font-semibold text-accent"
          >
            Go to semesters →
          </Link>
        </section>
      )}

      <section className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <StatCard
          featured
          label="Active semester"
          value={semester?.name ?? "None"}
          caption={semester?.isCurrent === false ? "Past semester" : "Current cycle"}
        />
        <StatCard
          label="Roster members"
          value={roster.active}
          caption="Active members"
        />
        <StatCard
          label="Projects"
          value={projects.total}
          caption={
            (["software", "hardware", "research", "event", "content"] as const)
              .filter((type) => projects[type] > 0)
              .map((type) => `${projects[type]} ${type}`)
              .join(" · ") || "No projects yet"
          }
        />
      </section>

      {warnings.length > 0 && <AttentionCard warnings={warnings} marcom={marcom} />}

      <div className="flex items-center justify-between pt-3">
        <h2 className="text-xl font-semibold text-ink">
          Projects this semester
        </h2>
        <Link
          href="/projects"
          className="text-[13px] font-semibold text-accent"
        >
          View all projects →
        </Link>
      </div>

      {recentProjects.length === 0 ? (
        <p className="text-[13px] text-muted">No projects this semester yet.</p>
      ) : (
        <section className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {recentProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </section>
      )}
    </div>
  );
}
