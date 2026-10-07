import type { RequestHandler } from "express";
import type { GithubService } from "../service/github.service.ts";

import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { HttpError } from "../../../shared/http-error.ts";
import { adminOnly } from "../../../shared/admin-only.ts";
import { createGithubController } from "../controller/github.controller.ts";

const noStore: RequestHandler = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};

/** Mounted at /api/admin/projects (after requireAuth + requireRole("ADMIN")). */
export function createGithubAdminRouter(service: GithubService) {
  const router = Router();
  const controller = createGithubController(service);
  router.use(noStore, adminOnly);
  router.get("/:projectId/github", controller.getAdmin);
  router.post("/:projectId/github/refresh", controller.refreshAdmin);
  return router;
}

/** Mounted at /api/me (after requireAuth + requireRole("MEMBER")). */
export function createGithubMemberRouter(service: GithubService) {
  const router = Router();
  const controller = createGithubController(service);
  router.get("/projects/:projectId/github", noStore, controller.getMember);
  return router;
}

function sameSecret(given: string | undefined, expected: string): boolean {
  if (given === undefined) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Mounted at /api/internal. The scheduler presents the shared secret in x-internal-secret. */
export function createGithubInternalRouter(
  service: GithubService,
  internalSecret: string | undefined,
) {
  const router = Router();
  const controller = createGithubController(service);
  const guard: RequestHandler = (req, _res, next) => {
    if (!internalSecret)
      return next(new HttpError(404, "NOT_FOUND", "Endpoint not found."));
    if (!sameSecret(req.get("x-internal-secret"), internalSecret))
      return next(
        new HttpError(401, "AUTH_REQUIRED", "Authentication is required."),
      );
    next();
  };
  router.post("/github/refresh-all", guard, controller.refreshAll);
  return router;
}
