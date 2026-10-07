// Reads the roster from the backend (GET /api/admin/semesters/:id/roster, plus the CSV import
// routes). Server-only: it goes through backendFetch, which attaches the admin session token.
import { backendFetch } from "@/shared/api/backend";
import { mapSemester } from "@/features/projects/service/projects.service";
import type {
  ImportRow,
  ImportRowsPage,
  ImportRowStatus,
  ImportStatus,
  ImportSummary,
  Member,
  MemberFilters,
  MemberDeleteImpact,
  MemberListPage,
  MissingMember,
} from "@/features/members/models/member";

export const PAGE_SIZE = 20;
export const IMPORT_ROWS_PAGE_SIZE = 10;

/** RosterMemberView in backend/src/modules/members/model/roster-member.model.ts. */
interface MemberDto {
  id: string;
  email: string;
  full_name: string;
  major: string | null;
  status: "ACTIVE" | "INACTIVE";
  linked: boolean;
}

/** RosterImportSummary in backend/src/modules/roster/model/roster-import.model.ts. */
export interface ImportSummaryDto {
  id: string;
  filename: string;
  status: ImportStatus;
  total_rows: number;
  valid_rows: number;
  update_rows: number;
  invalid_rows: number;
  deactivated_rows: number;
  expires_at: string;
  created_at: string;
  missing_active_rows: number;
}

interface ImportRowDto {
  row_number: number;
  full_name: string;
  email: string;
  major: string | null;
  status: ImportRowStatus;
  errors: string[];
}

export function mapMember(dto: MemberDto): Member {
  return {
    id: dto.id,
    fullName: dto.full_name,
    email: dto.email,
    major: dto.major ?? null,
    status: dto.status === "ACTIVE" ? "active" : "inactive",
    linked: dto.linked,
  };
}

export function mapImportSummary(dto: ImportSummaryDto): ImportSummary {
  return {
    id: dto.id,
    filename: dto.filename,
    status: dto.status,
    totalRows: dto.total_rows,
    validRows: dto.valid_rows,
    updateRows: dto.update_rows,
    invalidRows: dto.invalid_rows,
    deactivatedRows: dto.deactivated_rows,
    expiresAt: dto.expires_at,
    createdAt: dto.created_at,
    missingActiveRows: dto.missing_active_rows,
  };
}

export function mapImportRows(data: {
  items: ImportRowDto[];
  page: number;
  size: number;
  total: number;
}): ImportRowsPage {
  return {
    rows: data.items.map(
      (row): ImportRow => ({
        row: row.row_number,
        fullName: row.full_name,
        email: row.email,
        major: row.major ?? null,
        status: row.status,
        errors: row.errors ?? [],
      }),
    ),
    page: data.page,
    size: data.size,
    total: data.total,
  };
}

export async function getMembers(filters: MemberFilters): Promise<MemberListPage> {
  const { items: semesters } = await backendFetch<{
    items: { id: string; name: string; is_current: boolean }[];
  }>("/api/admin/semesters");
  const current =
    semesters.find((semester) => semester.id === filters.semester) ??
    semesters.find((semester) => semester.is_current);
  if (!current) {
    return { semester: null, items: [], page: 1, size: PAGE_SIZE, total: 0 };
  }

  const params = new URLSearchParams({ page: String(filters.page), size: String(PAGE_SIZE) });
  if (filters.search) params.set("search", filters.search);
  if (filters.status !== "all") params.set("status", filters.status.toUpperCase());

  const roster = await backendFetch<{
    items: MemberDto[];
    page: number;
    size: number;
    total: number;
  }>(`/api/admin/semesters/${current.id}/roster?${params}`);

  return {
    semester: mapSemester(current),
    items: roster.items.map(mapMember),
    page: roster.page,
    size: roster.size,
    total: roster.total,
  };
}

export async function fetchImportRows(
  importId: string,
  status: ImportRowStatus | "all",
  page: number,
): Promise<ImportRowsPage> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(IMPORT_ROWS_PAGE_SIZE),
  });
  if (status !== "all") params.set("status", status);
  return mapImportRows(
    await backendFetch(`/api/admin/roster/imports/${importId}/rows?${params}`),
  );
}

export async function fetchImportMissing(importId: string): Promise<MissingMember[]> {
  const { items } = await backendFetch<{
    items: { id: string; email: string; full_name: string }[];
  }>(`/api/admin/roster/imports/${importId}/missing?size=100`);
  return items.map((item) => ({ id: item.id, fullName: item.full_name, email: item.email }));
}

export async function fetchDeleteImpact(id: string): Promise<MemberDeleteImpact> {
  const { impact } = await backendFetch<{
    impact: {
      has_account: boolean;
      account_role: "ADMIN" | "MEMBER" | null;
      roster_entries: number;
      projects: number;
      deliveries: number;
    };
  }>(`/api/admin/roster/${id}/delete-impact`);
  return {
    hasAccount: impact.has_account,
    isAdmin: impact.account_role === "ADMIN",
    rosterEntries: impact.roster_entries,
    projects: impact.projects,
    deliveries: impact.deliveries,
  };
}
