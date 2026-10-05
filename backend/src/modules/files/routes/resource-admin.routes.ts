import type { ResourceService } from "../service/resource.service.ts";
import type { FileService } from "../service/file.service.ts";

import express, { Router } from "express";
import { adminOnly } from "../../../shared/admin-only.ts";
import { createFileController } from "../controller/file.controller.ts";
import { createResourceController } from "../controller/resource.controller.ts";
import { MAX_FILE_BYTES, UPLOAD_CONTENT_TYPES } from "../model/resource.model.ts";

/** Mounted at /api/admin/projects (after requireAuth + requireRole("ADMIN")). */
export function createResourceAdminRouter(
  resources: ResourceService,
  files: FileService,
) {
  const router = Router();
  const resourceController = createResourceController(resources);
  const fileController = createFileController(files);
  const fileBody = express.raw({
    type: UPLOAD_CONTENT_TYPES as string[],
    limit: MAX_FILE_BYTES,
  });

  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(adminOnly);

  router.get("/:projectId/resources", resourceController.list);
  router.put("/:projectId/resources/:slot", resourceController.setLink);
  router.delete("/:projectId/resources/:slot", resourceController.clear);
  router.post("/:projectId/resources/:slot/file", fileBody, fileController.upload);
  router.post(
    "/:projectId/files/:fileId/download-url",
    fileController.adminDownload,
  );
  return router;
}
