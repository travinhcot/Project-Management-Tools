import Link from "next/link";
import { AttentionCard } from "@/features/overview/components/AttentionCard";
import { ProjectCard } from "@/features/overview/components/ProjectCard";
import { StatCard } from "@/features/overview/components/StatCard";
import { Pill } from "@/shared/components/Pill";
import { getDashboard } from "@/features/overview/service/dashboard.service";

export async function OverviewPage() {
  const dashboard = await getDashboard();
  const { semester, roster, projects, warnings, recentProjects } = dashboard;

  return (
    <div className="flex flex-col gap-[22px]">
      <p className="whitespace-pre text-[13px] font-medium text-muted">
        {"Workspace  /  Project Management"}
      </p>

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[30px] font-bold text-ink">Project Management</h1>
          <p className="text-sm text-muted">
            A clear view of this semester’s people and projects.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone="surface">{semester.name} ▾</Pill>
          {semester.active && <Pill tone="success">● Active</Pill>}
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <StatCard
          label="Active semester"
          value={semester.name}
          caption="Current cycle"
        />
        <StatCard
          label="Roster members"
          value={roster.active}
          caption="Active members"
        />
        <StatCard
          label="Projects"
          value={projects.total}
          caption={`${projects.software} software · ${projects.hardware} hardware`}
        />
      </section>

      {warnings.length > 0 && <AttentionCard warnings={warnings} />}

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

      <section className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        {recentProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </section>
    </div>
  );
}
