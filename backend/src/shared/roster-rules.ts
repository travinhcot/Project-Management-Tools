import { invalid } from "./query-params.ts";

/** D-01: the only extra attributes kept in roster_members.other_info. */
export const OTHER_INFO_KEYS = ["student_id"] as const;
export type OtherInfo = { student_id?: string };

export const MAX_NAME_LENGTH = 200;
export const MAX_EMAIL_LENGTH = 320;
export const MAX_STUDENT_ID_LENGTH = 50;

const EMAIL_PATTERN = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

/** Same rule as the database trigger: trim + lower-case. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function nameProblem(value: string): string | null {
  const name = value.trim();
  if (!name) return "Full Name is required.";
  if ([...name].length > MAX_NAME_LENGTH) {
    return `Full Name must be at most ${MAX_NAME_LENGTH} characters.`;
  }
  return null;
}

export function emailProblem(value: string): string | null {
  const email = value.trim();
  if (!email) return "Email is required.";
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return "Email is invalid.";
  }
  return null;
}

export function studentIdProblem(value: string): string | null {
  if ([...value.trim()].length > MAX_STUDENT_ID_LENGTH) {
    return `Student ID must be at most ${MAX_STUDENT_ID_LENGTH} characters.`;
  }
  return null;
}

/** API input for other_info: only allowlisted keys, trimmed strings, empty values dropped. */
export function otherInfoInput(value: unknown): OtherInfo {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    invalid("other_info must be an object.");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !(OTHER_INFO_KEYS as readonly string[]).includes(key))) {
    invalid(`other_info supports only: ${OTHER_INFO_KEYS.join(", ")}.`);
  }
  const result: OtherInfo = {};
  if (input.student_id !== undefined && input.student_id !== null) {
    if (typeof input.student_id !== "string") invalid("student_id must be a string.");
    const studentId = input.student_id.trim();
    const problem = studentIdProblem(studentId);
    if (problem) invalid(problem);
    if (studentId) result.student_id = studentId;
  }
  return result;
}

export function fullNameInput(value: unknown): string {
  if (typeof value !== "string") invalid("full_name is required.");
  const problem = nameProblem(value);
  if (problem) invalid(problem);
  return value.trim();
}

export function emailInput(value: unknown): string {
  if (typeof value !== "string") invalid("email is required.");
  const problem = emailProblem(value);
  if (problem) invalid(problem);
  return value.trim();
}
