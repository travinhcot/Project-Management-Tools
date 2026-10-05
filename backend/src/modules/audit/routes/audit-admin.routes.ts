import type { AuditService } from "../service/audit.service.ts";

import { Router } from "express";
import { adminOnly } from "../../../shared/admin-only.ts";
import { createAuditController } from "../controller/audit.controller.ts";

/** Mounted at /api/admin/audit-events (after requireAuth + requireRole("ADMIN")). */
export function createAuditAdminRouter(service: AuditService) {
  const router = Router();
  const controller = createAuditController(service);
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(adminOnly);
  router.get("/", controller.list);
  // Static paths first so they are not read as an :eventId.
  router.get("/filters", controller.filters);
  router.get("/export", controller.export);
  router.get("/:eventId", controller.get);
  return router;
}
