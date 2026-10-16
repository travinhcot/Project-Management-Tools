import type { SupabaseClient } from "@supabase/supabase-js";
import type { RequestHandler } from "express";
import type { ActorLocals } from "./request-actor.ts";

import { HttpError } from "./http-error.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Guard = RequestHandler<Record<string, string>, unknown, unknown, Record<string, string>, ActorLocals>;

/**
 * Route guards for ids in the URL. The database stops a department admin from WRITING outside
 * their department (department-scope.schema.sql); these also stop them from READING by id,
 * because several read paths use the service-role client directly. A row in another department
 * is reported as not found, the same as one that does not exist.
 * ADMIN passes untouched. A malformed id is left for the route's own validation (400).
 */
export function createDepartmentGuards(client: SupabaseClient) {
  function byId(
    table: "projects" | "roster_members",
    param: string,
    notFound: HttpError,
  ): Guard {
    return async (req, res, next) => {
      try {
        const actor = res.locals.actor;
        if (!actor || actor.role !== "DEPT_ADMIN") return next();
        const id = req.params[param];
        if (typeof id !== "string" || !UUID.test(id)) return next();
        const { data, error } = await client
          .from(table)
          .select("department_id")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (!data || data.department_id !== actor.departmentId) throw notFound;
        next();
      } catch (error) {
        next(error);
      }
    };
  }

  return {
    /** For routes under /projects/:projectId. */
    projectInScope: byId(
      "projects",
      "projectId",
      new HttpError(404, "PROJECT_NOT_FOUND", "Project not found."),
    ),
    /** For routes under /roster/:rosterMemberId. */
    rosterMemberInScope: byId(
      "roster_members",
      "rosterMemberId",
      new HttpError(404, "ROSTER_MEMBER_NOT_FOUND", "Roster member not found."),
    ),
  };
}
