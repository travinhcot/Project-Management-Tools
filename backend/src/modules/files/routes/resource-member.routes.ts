import type { FileService } from "../service/file.service.ts";

import express, { Router } from "express";
import { createFileController } from "../controller/file.controller.ts";
import { ALLOWED_FILE_TYPES, MAX_FILE_BYTES } from "../model/resource.model.ts";

/** Mounted at /api/me (after requireAuth + requireRole(...MEMBER_ROLES)). Eligibility is checked per request in SQL. */
export function createResourceMemberRouter(files: FileService) {
  const router = Router();
  const controller = createFileController(files);
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.post(
    "/projects/:projectId/files/:fileId/download-url",
    controller.memberDownload,
  );
  // Final package (EVENT / CONTENT projects): Excel only; assignment is checked in SQL.
  router.post(
    "/projects/:projectId/final-package",
    express.raw({
      type: Object.values(ALLOWED_FILE_TYPES.FINAL_PACKAGE).map(
        (type) => type.contentType,
      ),
      limit: MAX_FILE_BYTES,
    }),
    controller.memberUploadFinalPackage,
  );
  return router;
}
