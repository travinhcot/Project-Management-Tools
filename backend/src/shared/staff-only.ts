import type { RequestHandler } from "express";
import type { ActorLocals } from "./request-actor.ts";

import { HttpError } from "./http-error.ts";

/**
 * Admits ADMIN and DEPT_ADMIN. A module that uses this MUST also scope its data with
 * `scopeFor(actor)` (department-scope.ts); modules that do not are still on `adminOnly`.
 */
export const staffOnly: RequestHandler<
  Record<string, string>,
  unknown,
  unknown,
  Record<string, string>,
  ActorLocals
> = (_req, res, next) => {
  const actor = res.locals.actor;
  if (!actor)
    return next(new HttpError(401, "AUTH_REQUIRED", "Authentication is required."));
  if (actor.role !== "ADMIN" && actor.role !== "DEPT_ADMIN") {
    return next(
      new HttpError(403, "FORBIDDEN", "You do not have permission for this action."),
    );
  }
  next();
};
