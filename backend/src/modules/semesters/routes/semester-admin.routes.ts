import type { SemesterService } from "../service/semester.service.ts";

import { Router } from "express";
import { adminOnly } from "../../../shared/admin-only.ts";
import { createSemesterAdminController } from "../controller/semester-admin.controller.ts";

/** Mounted at /api/admin/semesters (after requireAuth + requireRole("ADMIN")). */
export function createSemesterAdminRouter(service: SemesterService) {
  const router = Router();
  const controller = createSemesterAdminController(service);
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(adminOnly);
  router.get("/", controller.list);
  router.post("/", controller.create);
  router.get("/:semesterId", controller.get);
  router.patch("/:semesterId", controller.update);
  router.get("/:semesterId/current-impact", controller.currentImpact);
  router.post("/:semesterId/set-current", controller.setCurrent);
  return router;
}
