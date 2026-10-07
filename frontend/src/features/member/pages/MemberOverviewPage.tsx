import Link from "next/link";
import { ComingUpCard } from "@/features/member/components/ComingUpCard";
import { MemberPageHeader } from "@/features/member/components/MemberPageHeader";
import { NoAccessCard } from "@/features/member/components/NoAccessCard";
import { ProjectPreviewCard } from "@/features/member/components/ProjectPreviewCard";
import { formatDay, formatShortDay, formatTime } from "@/features/member/utils/format";
import {
  getMemberOverview,
  getMemberStatus,
} from "@/features/member/service/member.service";
import type { MemberProject } from "@/features/member/models/member";
import { StatCard } from "@/features/overview/components/StatCard";

export async function MemberOverviewPage() {
  const status = await getMemberStatus();
  if (!status.eligible) return <NoAccessCard email={status.email} />;

  const { semester, firstName, projects, nextMeeting, comingUp } = await getMemberOverview();
  const countOf = (type: MemberProject["type"]) =>
    projects.filter((project) => project.type === type).length;

  return (
    <div className="flex flex-col gap-[22px]">
      <MemberPageHeader
        breadcrumb={"Workspace  /  Project Management  /  Overview"}
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        subtitle="Your projects and what’s coming up this semester."
        semesterName={semester?.name}
      />

      <section className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <StatCard
          label="My projects"
          value={projects.length}
          caption={`${countOf("software")} software · ${countOf("hardware")} hardware · ${countOf("research")} research`}
        />
        <StatCard
          featured
          label="Next meeting"
          value={nextMeeting ? formatShortDay(nextMeeting.at) : "None"}
          caption={
            nextMeeting
              ? `${nextMeeting.projectName} · ${formatTime(nextMeeting.at)}`
              : "Nothing scheduled yet"
          }
        />
        <StatCard
          label="Semester access"
          value={semester?.name ?? "None"}
          caption={semester?.endsOn ? `Active until ${formatDay(semester.endsOn)}` : "Current semester"}
        />
      </section>

      <ComingUpCard items={comingUp} />

      <div className="flex items-center justify-between pt-3">
        <h2 className="text-xl font-semibold text-ink">My projects</h2>
        <Link href="/member/projects" className="text-[13px] font-semibold text-accent">
          View my projects →
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="text-[13px] text-muted">
          You have no assigned projects yet — contact EBMB.
        </p>
      ) : (
        <section className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectPreviewCard key={project.id} project={project} />
          ))}
        </section>
      )}
    </div>
  );
}
