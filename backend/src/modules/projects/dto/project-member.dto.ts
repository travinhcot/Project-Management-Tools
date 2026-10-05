import type { AssignRequest } from "../model/project-member.model.ts";

import {
  invalid,
  objectBody,
  rejectUnknownKeys,
} from "../../../shared/query-params.ts";
import { rosterMemberIdParam } from "../common/project-params.ts";

const MAX_BULK = 100;

/** Exactly one of roster_member_id (single) or roster_member_ids (bulk, 1-100). */
export function assignMembersBody(body: unknown): AssignRequest {
  const input = objectBody(body);
  rejectUnknownKeys(
    input,
    ["roster_member_id", "roster_member_ids"],
    "Only roster_member_id or roster_member_ids can be provided.",
  );
  const hasOne = input.roster_member_id !== undefined;
  const hasMany = input.roster_member_ids !== undefined;
  if (hasOne === hasMany) {
    invalid("Provide exactly one of roster_member_id or roster_member_ids.");
  }
  if (hasOne) {
    return {
      mode: "single",
      rosterMemberIds: [rosterMemberIdParam(input.roster_member_id)],
    };
  }
  const list = input.roster_member_ids;
  if (!Array.isArray(list) || list.length < 1 || list.length > MAX_BULK) {
    invalid(`roster_member_ids must contain 1 to ${MAX_BULK} ids.`);
  }
  const ids = [...new Set(list.map((value) => rosterMemberIdParam(value)))];
  return { mode: "bulk", rosterMemberIds: ids };
}
