// Mirrors RosterMemberView in backend/src/modules/members/model/roster-member.model.ts and the
// import types in backend/src/modules/roster (snake_case + UPPERCASE enums there; mapped in
// service/members.service.ts).
export type MemberStatus = "active" | "inactive";

export interface Member {
  id: string;
  fullName: string;
  email: string;
  /** Field of study; optional (Major column in the CSV). */
  major: string | null;
  status: MemberStatus;
  /** True once the person has signed in and linked an app account. */
  linked: boolean;
}

export interface MemberFilters {
  search: string;
  /** Defaults to active; inactive members are otherwise unreachable. */
  status: "all" | MemberStatus;
  page: number;
}

export interface MemberListPage {
  /** Null when no semester is current. */
  semester: import("@/features/projects/models/project").SemesterSummary | null;
  items: Member[];
  page: number;
  size: number;
  total: number;
}

export type ImportStatus = "PREVIEWED" | "COMMITTED" | "FAILED" | "EXPIRED";
export type ImportRowStatus = "VALID" | "UPDATE" | "INVALID" | "DUPLICATE";

/** RosterImportSummary: one uploaded CSV and what committing it would do. */
export interface ImportSummary {
  id: string;
  filename: string;
  status: ImportStatus;
  totalRows: number;
  /** New members. */
  validRows: number;
  updateRows: number;
  invalidRows: number;
  deactivatedRows: number;
  /** ISO time after which the preview can no longer be committed. */
  expiresAt: string;
  createdAt: string;
  /** Active members whose email is not in the file. */
  missingActiveRows: number;
}

export interface ImportRow {
  /** Line number in the file; the header is row 1. */
  row: number;
  fullName: string;
  email: string;
  major: string | null;
  status: ImportRowStatus;
  errors: string[];
}

export interface ImportRowsPage {
  rows: ImportRow[];
  page: number;
  size: number;
  total: number;
}

export interface MissingMember {
  id: string;
  fullName: string;
  email: string;
}
