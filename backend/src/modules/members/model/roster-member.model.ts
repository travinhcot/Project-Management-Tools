import type { OtherInfo } from "../../../shared/roster-rules.ts";

export const ROSTER_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type RosterStatus = (typeof ROSTER_STATUSES)[number];

export interface RosterMember {
  readonly id: string;
  readonly semester_id: string;
  readonly user_id: string | null;
  readonly email: string;
  readonly full_name: string;
  readonly other_info: OtherInfo & Record<string, unknown>;
  readonly department: string | null;
  readonly birth_year: number | null;
  readonly status: RosterStatus;
  readonly deactivated_at: string | null;
  readonly deactivation_reason: string | null;
  readonly last_import_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface RosterMemberView extends RosterMember {
  /** True once the person has signed in and the entry is tied to their account. */
  readonly linked: boolean;
}

export interface RosterListQuery {
  readonly semesterId: string;
  readonly search?: string;
  readonly status?: RosterStatus;
  readonly linked?: boolean;
  readonly department?: string;
  readonly birthYear?: number;
  readonly page: number;
  readonly size: number;
}

export interface RosterMemberCreate {
  readonly email: string;
  readonly full_name: string;
  readonly other_info: OtherInfo;
  readonly department: string | null;
  readonly birth_year: number | null;
}

export interface RosterMemberChanges {
  readonly full_name?: string;
  readonly other_info?: OtherInfo;
  readonly department?: string | null;
  readonly birth_year?: number | null;
  readonly status?: RosterStatus;
  readonly deactivation_reason?: string | null;
}
