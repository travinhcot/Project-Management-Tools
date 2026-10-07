import type {
  ArchivedFilter,
  ProjectChanges,
  ProjectCreate,
  ProjectListQuery,
  ProjectStatus,
  ProjectType,
  ProjectUpdate,
} from "../model/project.model.ts";

import {
  invalid,
  objectBody,
  rejectUnknownKeys,
  searchQuery,
  single,
} from "../../../shared/query-params.ts";
import { pageOf } from "../../../shared/pagination.ts";
import { semesterIdParam } from "../common/project-params.ts";
import { ARCHIVED_FILTERS, PROJECT_STATUSES, PROJECT_TYPES } from "../model/project.model.ts";

const MAX_NAME_LENGTH = 150;
const MAX_DESCRIPTION_LENGTH = 2000;
const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

function nameValue(value: unknown): string {
  if (typeof value !== "string") invalid("name is required.");
  const name = value.trim();
  if (!name) invalid("name is required.");
  if ([...name].length > MAX_NAME_LENGTH) {
    invalid(`name must be at most ${MAX_NAME_LENGTH} characters.`);
  }
  return name;
}

function typeValue(value: unknown): ProjectType {
  if (
    typeof value !== "string" ||
    !PROJECT_TYPES.includes(value as ProjectType)
  ) {
    invalid(`type must be one of ${PROJECT_TYPES.join(", ")}.`);
  }
  return value as ProjectType;
}

function statusValue(value: unknown): ProjectStatus {
  if (
    typeof value !== "string" ||
    !PROJECT_STATUSES.includes(value as ProjectStatus)
  ) {
    invalid("status must be PLANNING, ONGOING, COMPLETED or FAILED.");
  }
  return value as ProjectStatus;
}

function descriptionValue(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") invalid("description must be text or null.");
  const description = value.trim();
  if ([...description].length > MAX_DESCRIPTION_LENGTH) {
    invalid(
      `description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`,
    );
  }
  return description || null;
}

function archivedValue(value: string | undefined): ArchivedFilter {
  if (value === undefined) return "exclude";
  if (!ARCHIVED_FILTERS.includes(value as ArchivedFilter)) {
    invalid("archived must be exclude, include or only.");
  }
  return value as ArchivedFilter;
}

export function listProjectsQuery(
  query: Record<string, unknown>,
): ProjectListQuery {
  rejectUnknownKeys(
    query,
    ["semesterId", "search", "type", "status", "archived", "page", "size"],
    "The request contains invalid query parameters.",
  );
  const semesterId = single(query, "semesterId");
  const type = single(query, "type");
  const status = single(query, "status");
  return {
    semesterId:
      semesterId === undefined ? undefined : semesterIdParam(semesterId),
    search: searchQuery(query),
    type: type === undefined ? undefined : typeValue(type),
    status: status === undefined ? undefined : statusValue(status),
    archived: archivedValue(single(query, "archived")),
    ...pageOf(query),
  };
}

export function createProjectBody(body: unknown): ProjectCreate {
  const input = objectBody(body);
  rejectUnknownKeys(
    input,
    ["semester_id", "name", "type", "description", "status"],
    "Only semester_id, name, type, description and status can be provided.",
  );
  if (input.semester_id === undefined) invalid("semester_id is required.");
  return {
    semester_id: semesterIdParam(input.semester_id),
    name: nameValue(input.name),
    type: typeValue(input.type),
    description:
      input.description === undefined
        ? null
        : descriptionValue(input.description),
    status: input.status === undefined ? null : statusValue(input.status),
  };
}

export function updateProjectBody(body: unknown): ProjectUpdate {
  const input = objectBody(body);
  rejectUnknownKeys(
    input,
    ["expected_updated_at", "name", "description", "type", "status", "semester_id"],
    "Only expected_updated_at, name, description, type, status and semester_id can be provided.",
  );
  const expected = input.expected_updated_at;
  if (typeof expected !== "string" || !TIMESTAMP_PATTERN.test(expected)) {
    invalid(
      "expected_updated_at must be the updated_at value of the project you loaded.",
    );
  }
  const changes: { -readonly [K in keyof ProjectChanges]: ProjectChanges[K] } =
    {};
  if (input.name !== undefined) changes.name = nameValue(input.name);
  if (input.description !== undefined)
    changes.description = descriptionValue(input.description);
  if (input.type !== undefined) changes.type = typeValue(input.type);
  if (input.status !== undefined) changes.status = statusValue(input.status);
  if (input.semester_id !== undefined)
    changes.semester_id = semesterIdParam(input.semester_id);
  if (Object.keys(changes).length === 0)
    invalid("Provide at least one field to change.");
  return { expected_updated_at: expected, changes };
}

/** Archive body is optional: { "cancel_kickoff": true }. */
export function archiveProjectBody(body: unknown): { cancelKickoff: boolean } {
  if (body === undefined || body === null) return { cancelKickoff: false };
  const input = objectBody(body);
  rejectUnknownKeys(
    input,
    ["cancel_kickoff"],
    "Only cancel_kickoff can be provided.",
  );
  if (
    input.cancel_kickoff !== undefined &&
    typeof input.cancel_kickoff !== "boolean"
  ) {
    invalid("cancel_kickoff must be true or false.");
  }
  return { cancelKickoff: input.cancel_kickoff === true };
}
