import type { RequestHandler } from "express";
import type { UsersService } from "../service/user.service.ts";
import type { ActorLocals } from "../../../shared/request-actor.ts";

import { Router } from "express";
import { HttpError } from "../../../shared/http-error.ts";
import { createUserAdminController } from "../controller/user-admin.controller.ts";

/** Defense in depth: app.ts mounts the auth guards in front. This re-checks the actor they set. */
const adminOnly: RequestHandler<
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

export function createUserAdminRouter(service: UsersService) {
  const router = Router();
  const controller = createUserAdminController(service);
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(adminOnly);
  router.get("/", controller.list);
  router.patch("/:userId", controller.updateAccess);
  return router;
}
