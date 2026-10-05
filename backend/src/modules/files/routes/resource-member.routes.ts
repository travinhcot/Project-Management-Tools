import type { FileService } from "../service/file.service.ts";

import { Router } from "express";
import { createFileController } from "../controller/file.controller.ts";

/** Mounted at /api/me (after requireAuth + requireRole("MEMBER")). Eligibility is checked per request in SQL. */
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
  return router;
}
