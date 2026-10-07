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
  emailInput,
  fullNameInput,
  majorInput,
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
    ["search", "status", "linked", "page", "size"],
    "The request contains invalid query parameters.",
  );
  const status = single(query, "status");
  return {
    semesterId: semesterIdParam(semesterId),
    search: searchQuery(query),
    status: status === undefined ? undefined : statusValue(status),
    linked: booleanQuery(query, "linked"),
    ...pageOf(query),
  };
}

export function createRosterMemberBody(body: unknown): RosterMemberCreate {
  const input = objectBody(body);
  rejectUnknownKeys(input, ["email", "full_name", "major"], "Only email, full_name and major can be provided.");
  return {
    email: emailInput(input.email),
    full_name: fullNameInput(input.full_name),
    major: input.major === undefined ? null : majorInput(input.major),
  };
}

export function updateRosterMemberBody(body: unknown): RosterMemberChanges {
  const input = objectBody(body);
  rejectUnknownKeys(
    input,
    ["full_name", "major", "status", "deactivation_reason"],
    "Only full_name, major, status and deactivation_reason can be changed.",
  );
  if (Object.keys(input).length === 0) invalid("Provide at least one field to change.");

  const changes: {
    full_name?: string;
    major?: string | null;
    status?: RosterStatus;
    deactivation_reason?: string | null;
  } = {};
  if (input.full_name !== undefined) changes.full_name = fullNameInput(input.full_name);
  if (input.major !== undefined) changes.major = majorInput(input.major);
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
