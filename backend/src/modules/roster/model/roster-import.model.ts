export const IMPORT_ROW_STATUSES = [
  "VALID",
  "UPDATE",
  "INVALID",
  "DUPLICATE",
] as const;
export type ImportRowStatus = (typeof IMPORT_ROW_STATUSES)[number];
export type ImportStatus = "PREVIEWED" | "COMMITTED" | "FAILED" | "EXPIRED";

/** A parsed CSV row as sent to roster_create_import_preview (UPDATE is decided by SQL). */
export interface ImportRowInput {
  readonly row_number: number;
  readonly full_name: string;
  readonly email: string;
  readonly major: string | null;
  readonly status: "VALID" | "INVALID" | "DUPLICATE";
  readonly errors: readonly string[];
}

export interface ParsedRosterCsv {
  readonly rows: ImportRowInput[];
  readonly ignored_columns: string[];
}

export interface RosterImportListItem {
  readonly id: string;
  readonly semester_id: string;
  readonly initiated_by_user_id: string;
  readonly filename: string;
  readonly status: ImportStatus;
  readonly total_rows: number;
  readonly valid_rows: number;
  readonly update_rows: number;
  readonly invalid_rows: number;
  readonly deactivate_missing: boolean;
  readonly deactivated_rows: number;
  readonly expires_at: string | null;
  readonly created_at: string;
  readonly committed_at: string | null;
}

export interface RosterImportSummary extends RosterImportListItem {
  /** ACTIVE members of the semester that are not in the file (FR-ROS-05). */
  readonly missing_active_rows: number;
}

export interface ImportRowView {
  readonly row_number: number;
  readonly full_name: string | null;
  readonly email: string | null;
  readonly major: string | null;
  readonly status: ImportRowStatus;
  readonly errors: readonly string[];
}

export interface ImportMissingMember {
  readonly id: string;
  readonly email: string;
  readonly full_name: string;
  readonly user_id: string | null;
}
