import type { Metadata } from "next";
import { UsersAccessPage } from "@/features/users-access/pages/UsersAccessPage";
import { getCurrentUserId, getUsers } from "@/features/users-access/service/users.service";
import { USER_ROLES, type UserFilters, type UserRole } from "@/features/users-access/models/user";

export const metadata: Metadata = { title: "Users & access" };

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function parseFilters(params: SearchParams): UserFilters {
  const role = first(params.role);
  const status = first(params.status);
  const page = Number(first(params.page));
  return {
    search: first(params.q)?.trim().slice(0, 100) ?? "",
    role: USER_ROLES.includes(role as UserRole) ? (role as UserRole) : "all",
    status: status === "active" || status === "inactive" ? status : "all",
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseFilters(await searchParams);
  const [list, currentUserId] = await Promise.all([getUsers(filters), getCurrentUserId()]);
  return <UsersAccessPage list={list} filters={filters} currentUserId={currentUserId} />;
}
