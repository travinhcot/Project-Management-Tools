import type { DepartmentResourceService } from "../service/department-resource.service.ts";

import express, { Router } from "express";
import { createDepartmentResourceController } from "../controller/department-resource.controller.ts";
import { MAX_FILE_BYTES, UPLOAD_CONTENT_TYPES } from "../model/department-resource.model.ts";

/**
 * Mounted at /api/department-resources after requireAuth + requireRole(...ACCOUNT_ROLES).
 * Which department's library the caller may use is decided in SQL (department_resource_scope):
 * members and department admins get their own, the super-admin names one with ?department=.
 */
export function createDepartmentResourceRouter(service: DepartmentResourceService) {
  const router = Router();
  const controller = createDepartmentResourceController(service);
  const fileBody = express.raw({ type: [...UPLOAD_CONTENT_TYPES], limit: MAX_FILE_BYTES });

  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.get("/", controller.list);
  router.post("/links", controller.createLink);
  router.post("/files", fileBody, controller.upload);
  router.patch("/:resourceId", controller.update);
  router.delete("/:resourceId", controller.remove);
  router.post("/:resourceId/download-url", controller.downloadUrl);
  return router;
}
