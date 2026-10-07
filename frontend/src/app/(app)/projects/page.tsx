import type { Metadata } from "next";
import { ProjectsPage } from "@/features/projects/pages/ProjectsPage";
import { getSemesterOptions } from "@/features/semesters/service/semesters.service";
import { getProjects } from "@/features/projects/service/projects.service";
import {
  PROJECT_STATUSES,
  type ProjectFilters,
  type ProjectStatus,
} from "@/features/projects/models/project";
import type { ProjectType } from "@/shared/models/project";

export const metadata: Metadata = { title: "Projects" };

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

function parseFilters(params: SearchParams): ProjectFilters {
  const type = first(params.type);
  const status = first(params.status);
  const page = Number(first(params.page));
  return {
    search: first(params.q)?.trim().slice(0, 100) ?? "",
    type: type === "software" || type === "hardware" ? (type as ProjectType) : "all",
    status: PROJECT_STATUSES.includes(status as ProjectStatus) ? (status as ProjectStatus) : "all",
    semester: first(params.semester)?.trim().slice(0, 64) ?? "",
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseFilters(await searchParams);
  const [list, semesters] = await Promise.all([getProjects(filters), getSemesterOptions()]);
  return <ProjectsPage list={list} filters={filters} semesters={semesters} />;
}
