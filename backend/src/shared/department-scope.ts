import type { RequestActor } from "./request-actor.ts";

import { HttpError } from "./http-error.ts";

/** Mirrors public.departments.code. */
export const DEPARTMENT_CODES = ["TECH", "MARCOM", "HR"] as const;
export type DepartmentCodeName = (typeof DEPARTMENT_CODES)[number];

/**
 * The department an actor's queries are limited to: null for ADMIN (every department), the
 * department id for DEPT_ADMIN. Pass it to the SQL functions as `p_department_id`; the database
 * (public.assert_staff_actor) enforces the same rule, this keeps the backend honest too.
 */
export function scopeFor(actor: RequestActor): string | null {
  if (actor.role === "ADMIN") return null;
  if (actor.role === "DEPT_ADMIN" && actor.departmentId) return actor.departmentId;
  throw new HttpError(403, "FORBIDDEN", "You do not have permission for this action.");
}

/** True when a row belonging to `departmentId` is inside the scope. */
export function inScope(scope: string | null, departmentId: string): boolean {
  return scope === null || scope === departmentId;
}
