import type {
  SemesterChanges,
  SemesterCreate,
  SemesterListQuery,
  SemesterTerm,
} from "../model/semester.model.ts";

import {
  invalid,
  objectBody,
  rejectUnknownKeys,
  single,
  uuidParam,
} from "../../../shared/query-params.ts";
import { SEMESTER_TERMS } from "../model/semester.model.ts";

export const semesterIdParam = (value: unknown) => uuidParam(value, "semester id");

function termValue(value: unknown): SemesterTerm {
  if (typeof value !== "string" || !SEMESTER_TERMS.includes(value as SemesterTerm)) {
    invalid("term must be A, B or C.");
  }
  return value as SemesterTerm;
}

function yearValue(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 2000 || value > 2100) {
    invalid("year must be a whole number between 2000 and 2100.");
  }
  return value;
}

function dateValue(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    invalid(`${label} must be a date like 2026-09-01, or null.`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    invalid(`${label} is not a real date.`);
  }
  return value;
}

function urlValue(value: unknown, label = "demo_registration_url"): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > 2048 || /\s/.test(value)) {
    invalid(`${label} must be an https:// URL without spaces, or null.`);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    invalid(`${label} must be a valid URL.`);
  }
  if (url.protocol !== "https:") invalid(`${label} must start with https://.`);
  return value;
}

function checkDateOrder(startsOn: string | null | undefined, endsOn: string | null | undefined) {
  if (startsOn && endsOn && endsOn < startsOn) invalid("ends_on cannot be before starts_on.");
}

const FIELDS = ["term", "year", "starts_on", "ends_on", "demo_registration_url"] as const;
const UPDATE_FIELDS = [...FIELDS, "kickoff_meeting_url"] as const;

export function createSemesterBody(body: unknown): SemesterCreate {
  const input = objectBody(body);
  rejectUnknownKeys(input, FIELDS, "Only term, year, starts_on, ends_on and demo_registration_url can be provided.");
  if (input.term === undefined || input.year === undefined) invalid("term and year are required.");
  const starts_on = input.starts_on === undefined ? null : dateValue(input.starts_on, "starts_on");
  const ends_on = input.ends_on === undefined ? null : dateValue(input.ends_on, "ends_on");
  checkDateOrder(starts_on, ends_on);
  return {
    term: termValue(input.term),
    year: yearValue(input.year),
    starts_on,
    ends_on,
    demo_registration_url:
      input.demo_registration_url === undefined ? null : urlValue(input.demo_registration_url),
  };
}

export function updateSemesterBody(body: unknown): SemesterChanges {
  const input = objectBody(body);
  rejectUnknownKeys(
    input,
    UPDATE_FIELDS,
    "Only term, year, starts_on, ends_on, demo_registration_url and kickoff_meeting_url can be changed.",
  );
  if (Object.keys(input).length === 0) invalid("Provide at least one field to change.");
  const changes: {
    -readonly [K in keyof SemesterChanges]: SemesterChanges[K];
  } = {};
  if (input.term !== undefined) changes.term = termValue(input.term);
  if (input.year !== undefined) changes.year = yearValue(input.year);
  if (input.starts_on !== undefined) changes.starts_on = dateValue(input.starts_on, "starts_on");
  if (input.ends_on !== undefined) changes.ends_on = dateValue(input.ends_on, "ends_on");
  if (input.demo_registration_url !== undefined) {
    changes.demo_registration_url = urlValue(input.demo_registration_url);
  }
  if (input.kickoff_meeting_url !== undefined) {
    changes.kickoff_meeting_url = urlValue(input.kickoff_meeting_url, "kickoff_meeting_url");
  }
  checkDateOrder(changes.starts_on, changes.ends_on);
  return changes;
}

export function listSemestersQuery(query: Record<string, unknown>): SemesterListQuery {
  rejectUnknownKeys(query, ["year", "term"], "The request contains invalid query parameters.");
  const year = single(query, "year");
  const term = single(query, "term");
  if (year !== undefined && !/^\d{4}$/.test(year)) invalid("year must be a 4-digit year.");
  return {
    year: year === undefined ? undefined : Number(year),
    term: term === undefined ? undefined : termValue(term),
  };
}
