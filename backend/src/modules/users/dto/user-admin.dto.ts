import type { AdminUserAccessUpdate, AdminUserListQuery, UserRole } from "../model/user.model.ts";

import { HttpError } from "../../../shared/http-error.ts";
import { USER_ROLES } from "../model/user.model.ts";

function invalid(message: string): never {
  throw new HttpError(400, "INVALID_INPUT", message);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function userIdParam(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) invalid("A valid user id is required.");
  return value.toLowerCase();
}

function single(query: Record<string, unknown>, key: string): string | undefined {
  const value = query[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") invalid(`Query parameter "${key}" must appear once.`);
  return value;
}

function positiveInt(raw: string | undefined, fallback: number, max: number, key: string): number {
  if (raw === undefined) return fallback;
  if (!/^\d{1,6}$/.test(raw)) invalid(`${key} must be a positive integer.`);
  const n = Number(raw);
  if (n < 1 || n > max) invalid(`${key} must be between 1 and ${max}.`);
  return n;
}

export function listUsersQuery(query: Record<string, unknown>): AdminUserListQuery {
  const allowed = ["search", "role", "active", "page", "size"];
  if (Object.keys(query).some((key) => !allowed.includes(key))) {
    invalid("The request contains invalid query parameters.");
  }
  const search = single(query, "search")?.trim();
  if (search !== undefined && [...search].length > 100) invalid("Search must be at most 100 characters.");
  const role = single(query, "role");
  if (role !== undefined && !USER_ROLES.includes(role as UserRole)) invalid("Role must be ADMIN or MEMBER.");
  const active = single(query, "active");
  if (active !== undefined && active !== "true" && active !== "false") invalid("active must be true or false.");
  return {
    search: search || undefined,
    role: role as UserRole | undefined,
    is_active: active === undefined ? undefined : active === "true",
    page: positiveInt(single(query, "page"), 1, 100_000, "page"),
    size: positiveInt(single(query, "size"), 20, 100, "size"),
  };
}

export function accessUpdateBody(body: unknown): AdminUserAccessUpdate {
  if (!body || typeof body !== "object" || Array.isArray(body)) invalid("A JSON object is required.");
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => key !== "role" && key !== "is_active")) {
    invalid("Only role and is_active can be changed.");
  }
  if (input.role === undefined && input.is_active === undefined) invalid("Provide role or is_active.");
  if (input.role !== undefined && !USER_ROLES.includes(input.role as UserRole)) {
    invalid("Role must be ADMIN or MEMBER.");
  }
  if (input.is_active !== undefined && typeof input.is_active !== "boolean") {
    invalid("is_active must be true or false.");
  }
  return { role: input.role as UserRole | undefined, is_active: input.is_active as boolean | undefined };
}
