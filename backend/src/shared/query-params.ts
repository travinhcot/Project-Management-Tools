import { HttpError } from "./http-error.ts";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function invalid(message: string): never {
  throw new HttpError(400, "INVALID_INPUT", message);
}

export function uuidParam(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    invalid(`A valid ${label} is required.`);
  }
  return value.toLowerCase();
}

/** A query parameter that must appear at most once. */
export function single(
  query: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = query[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string")
    invalid(`Query parameter "${key}" must appear once.`);
  return value;
}

export function positiveInt(
  raw: string | undefined,
  fallback: number,
  max: number,
  key: string,
): number {
  if (raw === undefined) return fallback;
  if (!/^\d{1,6}$/.test(raw)) invalid(`${key} must be a positive integer.`);
  const n = Number(raw);
  if (n < 1 || n > max) invalid(`${key} must be between 1 and ${max}.`);
  return n;
}

export function rejectUnknownKeys(
  input: Record<string, unknown>,
  allowed: readonly string[],
  message: string,
): void {
  if (Object.keys(input).some((key) => !allowed.includes(key)))
    invalid(message);
}

export function objectBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    invalid("A JSON object is required.");
  }
  return body as Record<string, unknown>;
}

export function pageQuery(query: Record<string, unknown>): {
  page: number;
  size: number;
} {
  return {
    page: positiveInt(single(query, "page"), 1, 100_000, "page"),
    size: positiveInt(single(query, "size"), 20, 100, "size"),
  };
}

export function booleanQuery(
  query: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const value = single(query, key);
  if (value === undefined) return undefined;
  if (value !== "true" && value !== "false")
    invalid(`${key} must be true or false.`);
  return value === "true";
}

/** Search text: trimmed, at most 100 characters, empty means "no search". */
export function searchQuery(
  query: Record<string, unknown>,
): string | undefined {
  const search = single(query, "search")?.trim();
  if (search !== undefined && [...search].length > 100) {
    invalid("Search must be at most 100 characters.");
  }
  return search || undefined;
}
