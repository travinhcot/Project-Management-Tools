import type { MemberRole, ProjectMemberView } from "./project.model.ts";

export const ASSIGNMENT_REJECT_REASONS = [
  "ROSTER_MEMBER_NOT_FOUND",
  "ROSTER_MEMBER_OTHER_SEMESTER",
  "ROSTER_MEMBER_INACTIVE",
  "ALREADY_ASSIGNED",
] as const;
export type AssignmentRejectReason = (typeof ASSIGNMENT_REJECT_REASONS)[number];

/** Parsed POST body: one id (single mode) or a list (bulk mode). */
export interface AssignRequest {
  readonly mode: "single" | "bulk";
  readonly rosterMemberIds: readonly string[];
  /** LEADER is only accepted in single mode. */
  readonly role: MemberRole;
}

/** Raw result of admin_assign_project_members. */
export interface AssignOutcome {
  readonly accepted: readonly {
    assignment_id: string;
    roster_member_id: string;
    added_at: string;
  }[];
  readonly rejected: readonly {
    roster_member_id: string;
    reason: AssignmentRejectReason;
  }[];
}

export interface AssignmentRejection {
  readonly roster_member_id: string;
  readonly reason: AssignmentRejectReason;
  readonly message: string;
}

export interface BulkAssignResult {
  readonly accepted: readonly ProjectMemberView[];
  readonly rejected: readonly AssignmentRejection[];
}

export interface RemovedAssignment {
  readonly assignment_id: string;
  readonly roster_member_id: string;
  readonly removed_at: string;
}

/** Raw row returned by admin_set_project_member_role. */
export interface RoleChangeRow {
  readonly id: string;
  readonly roster_member_id: string;
  readonly role: MemberRole;
  readonly added_at: string;
}
