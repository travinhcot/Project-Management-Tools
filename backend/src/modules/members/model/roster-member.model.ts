export const ROSTER_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type RosterStatus = (typeof ROSTER_STATUSES)[number];

export interface RosterMember {
  readonly id: string;
  readonly semester_id: string;
  readonly user_id: string | null;
  readonly email: string;
  readonly full_name: string;
  readonly major: string | null;
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
  readonly page: number;
  readonly size: number;
}

export interface RosterMemberCreate {
  readonly email: string;
  readonly full_name: string;
  readonly major: string | null;
}

export interface RosterMemberChanges {
  readonly full_name?: string;
  readonly major?: string | null;
  readonly status?: RosterStatus;
  readonly deactivation_reason?: string | null;
}

/** What deleting a member permanently would remove (shown before the delete). */
export interface RosterDeleteImpact {
  readonly full_name: string;
  readonly email: string;
  readonly has_account: boolean;
  readonly account_role: "ADMIN" | "MEMBER" | null;
  /** Roster entries removed: this one plus the account's entries in other semesters. */
  readonly roster_entries: number;
  readonly projects: number;
  readonly deliveries: number;
}
