import type { RequestHandler } from "express";
import type { ActorLocals } from "./request-actor.ts";

import { HttpError } from "./http-error.ts";

/** Defense in depth: app.ts mounts the auth guards in front. This re-checks the actor they set. */
export const adminOnly: RequestHandler<
  Record<string, string>,
  unknown,
  unknown,
  Record<string, string>,
  ActorLocals
> = (_req, res, next) => {
  const actor = res.locals.actor;
  if (!actor)
    return next(
      new HttpError(401, "AUTH_REQUIRED", "Authentication is required."),
    );
  if (actor.role !== "ADMIN") {
    return next(
      new HttpError(
        403,
        "FORBIDDEN",
        "You do not have permission for this action.",
      ),
    );
  }
  next();
};
