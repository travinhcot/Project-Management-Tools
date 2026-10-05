import type { ProjectService } from "../service/project.service.ts";

import { Router } from "express";
import { adminOnly } from "../../../shared/admin-only.ts";
import { createProjectAdminController } from "../controller/project-admin.controller.ts";

/** Mounted at /api/admin/projects (after requireAuth + requireRole("ADMIN")). */
export function createProjectAdminRouter(service: ProjectService) {
  const router = Router();
  const controller = createProjectAdminController(service);
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(adminOnly);
  router.get("/", controller.list);
  router.post("/", controller.create);
  router.get("/:projectId", controller.get);
  router.patch("/:projectId", controller.update);
  router.get("/:projectId/archive-impact", controller.archiveImpact);
  router.post("/:projectId/archive", controller.archive);
  router.post("/:projectId/unarchive", controller.unarchive);
  return router;
}
