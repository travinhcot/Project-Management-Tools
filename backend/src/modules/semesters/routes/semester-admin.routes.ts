import type { SemesterService } from "../service/semester.service.ts";

import { Router } from "express";
import { adminOnly } from "../../../shared/admin-only.ts";
import { staffOnly } from "../../../shared/staff-only.ts";
import { createSemesterAdminController } from "../controller/semester-admin.controller.ts";

/** Mounted at /api/admin/semesters (after requireAuth + requireRole("ADMIN")). */
export function createSemesterAdminRouter(service: SemesterService) {
  const router = Router();
  const controller = createSemesterAdminController(service);
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  // A department admin may read semesters (to pick the current one); only the super-admin changes them.
  router.get("/", staffOnly, controller.list);
  router.get("/:semesterId", staffOnly, controller.get);
  router.post("/", adminOnly, controller.create);
  router.patch("/:semesterId", adminOnly, controller.update);
  router.get("/:semesterId/current-impact", adminOnly, controller.currentImpact);
  router.post("/:semesterId/set-current", adminOnly, controller.setCurrent);
  return router;
}
