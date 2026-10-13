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
  /** Set on the commit response only: accounts created for the people just imported. */
  readonly provisioning?: ProvisioningSummary;
}

export type DepartmentName = "TECH" | "MARCOM" | "HR";

/** A roster entry that needs an account. `department` is its department code, null when unset. */
export interface ProvisionCandidate {
  readonly id: string;
  readonly email: string;
  readonly full_name: string;
  readonly department: DepartmentName | null;
}

export type ProvisionStatus = "linked" | "would" | "skipped" | "failed";

export interface ProvisionResult {
  readonly email: string;
  readonly full_name: string;
  readonly status: ProvisionStatus;
  readonly detail: string;
}

/** Counts shown after an import commit; `error` set when provisioning itself could not run. */
export interface ProvisioningSummary {
  readonly linked: number;
  readonly skipped: number;
  readonly failed: number;
  /** Candidates beyond the inline limit; run `provision:roster` for them. */
  readonly remaining: number;
  readonly failures: readonly { readonly email: string; readonly reason: string }[];
  readonly error?: true;
}

/** What the roster module needs from the users module (wired in server.ts). */
export interface ProfileProvisioner {
  provisionVerifiedProfile(
    identity: { id: string; email: string; email_verified_at: string },
    fullName: string,
    role: "MEMBER",
    departmentCode?: DepartmentName,
  ): Promise<{ id: string }>;
}

/** What the roster module may record in the audit log (wired in server.ts). */
export interface AuditPort {
  record(event: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    semesterId?: string | null;
    metadata?: Readonly<Record<string, unknown>>;
    requestId: string;
  }): Promise<void>;
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
