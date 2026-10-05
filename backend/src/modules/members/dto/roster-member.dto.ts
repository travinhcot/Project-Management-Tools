import type {
  RosterListQuery,
  RosterMemberChanges,
  RosterMemberCreate,
  RosterStatus,
} from "../model/roster-member.model.ts";

import {
  booleanQuery,
  invalid,
  objectBody,
  rejectUnknownKeys,
  searchQuery,
  single,
} from "../../../shared/query-params.ts";
import {
  birthYearInput,
  birthYearQuery,
  departmentInput,
  emailInput,
  fullNameInput,
  otherInfoInput,
} from "../../../shared/roster-rules.ts";
import { pageOf } from "../../../shared/pagination.ts";
import { semesterIdParam } from "../common/member-params.ts";
import { ROSTER_STATUSES } from "../model/roster-member.model.ts";

function statusValue(value: unknown): RosterStatus {
  if (typeof value !== "string" || !ROSTER_STATUSES.includes(value as RosterStatus)) {
    invalid("status must be ACTIVE or INACTIVE.");
  }
  return value as RosterStatus;
}

export function listRosterQuery(
  semesterId: unknown,
  query: Record<string, unknown>,
): RosterListQuery {
  rejectUnknownKeys(
    query,
    ["search", "status", "linked", "department", "birth_year", "page", "size"],
    "The request contains invalid query parameters.",
  );
  const status = single(query, "status");
  const department = single(query, "department")?.trim();
  const birthYear = single(query, "birth_year");
  return {
    semesterId: semesterIdParam(semesterId),
    search: searchQuery(query),
    status: status === undefined ? undefined : statusValue(status),
    linked: booleanQuery(query, "linked"),
    department: department || undefined,
    birthYear: birthYear === undefined ? undefined : birthYearQuery(birthYear),
    ...pageOf(query),
  };
}

export function createRosterMemberBody(body: unknown): RosterMemberCreate {
  const input = objectBody(body);
  rejectUnknownKeys(input, ["email", "full_name", "other_info", "department", "birth_year"], "Only email, full_name, other_info, department and birth_year can be provided.");
  return {
    email: emailInput(input.email),
    full_name: fullNameInput(input.full_name),
    other_info: otherInfoInput(input.other_info),
    department:
      input.department === undefined ? null : departmentInput(input.department),
    birth_year:
      input.birth_year === undefined ? null : birthYearInput(input.birth_year),
  };
}

export function updateRosterMemberBody(body: unknown): RosterMemberChanges {
  const input = objectBody(body);
  rejectUnknownKeys(
    input,
    ["full_name", "other_info", "department", "birth_year", "status", "deactivation_reason"],
    "Only full_name, other_info, department, birth_year, status and deactivation_reason can be changed.",
  );
  if (Object.keys(input).length === 0) invalid("Provide at least one field to change.");

  const changes: {
    full_name?: string;
    other_info?: ReturnType<typeof otherInfoInput>;
    department?: string | null;
    birth_year?: number | null;
    status?: RosterStatus;
    deactivation_reason?: string | null;
  } = {};
  if (input.full_name !== undefined) changes.full_name = fullNameInput(input.full_name);
  if (input.other_info !== undefined) changes.other_info = otherInfoInput(input.other_info);
  if (input.department !== undefined) changes.department = departmentInput(input.department);
  if (input.birth_year !== undefined) changes.birth_year = birthYearInput(input.birth_year);
  if (input.status !== undefined) changes.status = statusValue(input.status);
  if (input.deactivation_reason !== undefined) {
    if (changes.status === "ACTIVE") invalid("deactivation_reason cannot be set when reactivating.");
    const reason = input.deactivation_reason;
    if (reason !== null && typeof reason !== "string") invalid("deactivation_reason must be text or null.");
    const trimmed = reason === null ? "" : reason.trim();
    if ([...trimmed].length > 500) invalid("deactivation_reason must be at most 500 characters.");
    changes.deactivation_reason = trimmed || null;
  }
  return changes;
}
