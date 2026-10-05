import type { RequestHandler } from "express";
import type { FileService } from "../service/file.service.ts";

import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { HttpError } from "../../../shared/http-error.ts";
import { createFileController } from "../controller/file.controller.ts";

function sameSecret(given: string | undefined, expected: string): boolean {
  if (given === undefined) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Mounted at /api/internal. Callers present the shared secret in x-internal-secret. */
export function createFileInternalRouter(
  files: FileService,
  internalSecret: string | undefined,
) {
  const router = Router();
  const controller = createFileController(files);
  const guard: RequestHandler = (req, _res, next) => {
    if (!internalSecret) {
      return next(new HttpError(404, "NOT_FOUND", "Endpoint not found."));
    }
    if (!sameSecret(req.get("x-internal-secret"), internalSecret)) {
      return next(new HttpError(401, "AUTH_REQUIRED", "Authentication is required."));
    }
    next();
  };
  router.post("/files/cleanup", guard, controller.cleanup);
  return router;
}
