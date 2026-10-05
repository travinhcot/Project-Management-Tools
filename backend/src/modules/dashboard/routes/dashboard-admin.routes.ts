import type { DashboardService } from "../service/dashboard.service.ts";

import { Router } from "express";
import { adminOnly } from "../../../shared/admin-only.ts";
import { createDashboardController } from "../controller/dashboard.controller.ts";

/** Mounted at /api/admin/dashboard (after requireAuth + requireRole("ADMIN")). */
export function createDashboardAdminRouter(service: DashboardService) {
  const router = Router();
  const controller = createDashboardController(service);
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(adminOnly);
  router.get("/", controller.summary);
  router.get("/trends", controller.trends);
  return router;
}
