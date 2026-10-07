import { MemberPageHeader } from "@/features/member/components/MemberPageHeader";
import { NoAccessCard } from "@/features/member/components/NoAccessCard";
import { ProjectsExplorer } from "@/features/member/components/ProjectsExplorer";
import {
  getMemberProjects,
  getMemberStatus,
} from "@/features/member/service/member.service";

export async function MemberProjectsPage() {
  const status = await getMemberStatus();
  if (!status.eligible) return <NoAccessCard email={status.email} />;

  const projects = await getMemberProjects();
  const semesterName = projects[0]?.semesterName ?? null;

  return (
    <div className="flex flex-col gap-[22px]">
      <MemberPageHeader
        breadcrumb={"Workspace  /  Project Management  /  My projects"}
        title="My projects"
        subtitle="Projects you’re assigned to this semester. Resources are read-only."
        semesterName={semesterName}
      />
      <ProjectsExplorer projects={projects} semesterName={semesterName} />
    </div>
  );
}
