import type { RequestHandler } from "express";
import type { ProcessorService } from "../service/processor.service.ts";

import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { HttpError } from "../../../shared/http-error.ts";
import { createProcessorController } from "../controller/campaign.controller.ts";

function sameSecret(given: string | undefined, expected: string): boolean {
  if (given === undefined) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Mounted at /api/internal. The scheduler presents the shared secret in x-internal-secret. */
export function createCampaignInternalRouter(
  processor: ProcessorService,
  internalSecret: string | undefined,
) {
  const router = Router();
  const controller = createProcessorController(processor);
  const guard: RequestHandler = (req, _res, next) => {
    if (!internalSecret) {
      return next(new HttpError(404, "NOT_FOUND", "Endpoint not found."));
    }
    if (!sameSecret(req.get("x-internal-secret"), internalSecret)) {
      return next(
        new HttpError(401, "AUTH_REQUIRED", "Authentication is required."),
      );
    }
    next();
  };
  router.post("/campaigns/process", guard, controller.process);
  return router;
}
