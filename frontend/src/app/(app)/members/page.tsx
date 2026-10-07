import type { Metadata } from "next";
import { MembersPage } from "@/features/members/pages/MembersPage";
import { getSemesterOptions } from "@/features/semesters/service/semesters.service";
import { getMembers } from "@/features/members/service/members.service";
import type { MemberFilters } from "@/features/members/models/member";

export const metadata: Metadata = { title: "Members" };

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

function parseFilters(params: SearchParams): MemberFilters {
  const status = first(params.status);
  const page = Number(first(params.page));
  return {
    search: first(params.q)?.trim().slice(0, 100) ?? "",
    status: status === "inactive" || status === "all" ? status : "active",
    semester: first(params.semester)?.trim().slice(0, 64) ?? "",
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseFilters(await searchParams);
  const [list, semesters] = await Promise.all([getMembers(filters), getSemesterOptions()]);
  return <MembersPage list={list} filters={filters} semesters={semesters} />;
}
