import type { RequestHandler } from "express";
import type { DepartmentResourceService } from "../service/department-resource.service.ts";

import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { HttpError } from "../../../shared/http-error.ts";
import { createDepartmentResourceController } from "../controller/department-resource.controller.ts";

function sameSecret(given: string | undefined, expected: string): boolean {
  if (given === undefined) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Mounted at /api/internal. Callers present the shared secret in x-internal-secret. */
export function createDepartmentResourceInternalRouter(
  service: DepartmentResourceService,
  internalSecret: string | undefined,
) {
  const router = Router();
  const controller = createDepartmentResourceController(service);
  const guard: RequestHandler = (req, _res, next) => {
    if (!internalSecret) return next(new HttpError(404, "NOT_FOUND", "Endpoint not found."));
    if (!sameSecret(req.get("x-internal-secret"), internalSecret)) {
      return next(new HttpError(401, "AUTH_REQUIRED", "Authentication is required."));
    }
    next();
  };
  router.post("/department-resources/cleanup", guard, controller.cleanup);
  return router;
}
