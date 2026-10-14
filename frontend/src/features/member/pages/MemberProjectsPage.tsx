import { DEPARTMENT_PROJECT_TYPES } from "@/config/departments";
import { MemberPageHeader } from "@/features/member/components/MemberPageHeader";
import { NoAccessCard } from "@/features/member/components/NoAccessCard";
import { ProjectsExplorer } from "@/features/member/components/ProjectsExplorer";
import type { MemberProject, SemesterAccess } from "@/features/member/models/member";
import {
  getMemberProfile,
  getMemberProjects,
  getMemberProjectsAllSemesters,
  getMemberStatus,
} from "@/features/member/service/member.service";

export async function MemberProjectsPage() {
  const status = await getMemberStatus();
  if (!status.eligible) return <NoAccessCard email={status.email} />;

  // Marcom members can switch between their current, upcoming and previous semesters.
  const allSemesters = status.departmentCode === "MARCOM";
  let projects: MemberProject[];
  let semesters: SemesterAccess[] | undefined;
  if (allSemesters) {
    const [lists, profile] = await Promise.all([
      getMemberProjectsAllSemesters(),
      getMemberProfile(),
    ]);
    projects = [...lists.current, ...lists.other];
    semesters = profile.semesters;
  } else {
    projects = await getMemberProjects();
  }
  const semesterName = projects.find((project) => project.semesterName)?.semesterName ?? null;

  return (
    <div className="flex flex-col gap-[22px]">
      <MemberPageHeader
        breadcrumb={"Workspace  /  Project Management  /  My projects"}
        title="My projects"
        subtitle="Projects you’re assigned to this semester. Resources are read-only."
        semesterName={semesterName}
      />
      <ProjectsExplorer
        projects={projects}
        semesterName={semesterName}
        semesters={semesters}
        types={status.departmentCode ? DEPARTMENT_PROJECT_TYPES[status.departmentCode] : []}
      />
    </div>
  );
}
