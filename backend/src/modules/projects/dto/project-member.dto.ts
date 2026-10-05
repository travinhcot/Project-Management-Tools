import type { AssignRequest } from "../model/project-member.model.ts";
import type { MemberRole } from "../model/project.model.ts";

import {
  invalid,
  objectBody,
  rejectUnknownKeys,
} from "../../../shared/query-params.ts";
import { rosterMemberIdParam } from "../common/project-params.ts";
import { MEMBER_ROLES } from "../model/project.model.ts";

const MAX_BULK = 100;

function roleValue(value: unknown): MemberRole {
  if (typeof value !== "string" || !MEMBER_ROLES.includes(value as MemberRole)) {
    invalid("role must be LEADER or MEMBER.");
  }
  return value as MemberRole;
}

/** Body for PATCH .../members/:rosterMemberId: { "role": "LEADER" }. */
export function memberRoleBody(body: unknown): { role: MemberRole } {
  const input = objectBody(body);
  rejectUnknownKeys(input, ["role"], "Only role can be provided.");
  return { role: roleValue(input.role) };
}

/** Exactly one of roster_member_id (single) or roster_member_ids (bulk, 1-100). */
export function assignMembersBody(body: unknown): AssignRequest {
  const input = objectBody(body);
  rejectUnknownKeys(
    input,
    ["roster_member_id", "roster_member_ids", "role"],
    "Only roster_member_id, roster_member_ids or role can be provided.",
  );
  const hasOne = input.roster_member_id !== undefined;
  const hasMany = input.roster_member_ids !== undefined;
  const role = input.role === undefined ? "MEMBER" : roleValue(input.role);
  if (hasOne === hasMany) {
    invalid("Provide exactly one of roster_member_id or roster_member_ids.");
  }
  if (hasOne) {
    return {
      mode: "single",
      rosterMemberIds: [rosterMemberIdParam(input.roster_member_id)],
      role,
    };
  }
  if (role === "LEADER") invalid("role LEADER can only be set when assigning one person.");
  const list = input.roster_member_ids;
  if (!Array.isArray(list) || list.length < 1 || list.length > MAX_BULK) {
    invalid(`roster_member_ids must contain 1 to ${MAX_BULK} ids.`);
  }
  const ids = [...new Set(list.map((value) => rosterMemberIdParam(value)))];
  return { mode: "bulk", rosterMemberIds: ids, role };
}
