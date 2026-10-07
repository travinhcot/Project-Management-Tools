import { invalid } from "./query-params.ts";

export const MAX_NAME_LENGTH = 200;
export const MAX_EMAIL_LENGTH = 320;
export const MAX_MAJOR_LENGTH = 100;

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

export function majorProblem(value: string): string | null {
  if ([...value.trim()].length > MAX_MAJOR_LENGTH) {
    return `Major must be at most ${MAX_MAJOR_LENGTH} characters.`;
  }
  return null;
}

/** API input: text trimmed, empty -> null. */
export function majorInput(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") invalid("major must be text or null.");
  const major = value.trim();
  const problem = majorProblem(major);
  if (problem) invalid(problem);
  return major || null;
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
