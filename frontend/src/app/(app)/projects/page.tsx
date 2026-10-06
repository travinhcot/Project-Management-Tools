import type { Metadata } from "next";
import { ProjectsPage } from "@/features/projects/pages/ProjectsPage";
import { getProjects } from "@/features/projects/service/projects.service";

export const metadata: Metadata = { title: "Projects" };

export default async function Page() {
  const { semester, projects } = await getProjects();
  return <ProjectsPage semester={semester} initialProjects={projects} />;
}
