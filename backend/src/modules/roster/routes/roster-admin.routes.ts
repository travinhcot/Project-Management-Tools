import type { RosterImportService } from "../service/roster-import.service.ts";

import express, { Router } from "express";
import { adminOnly } from "../../../shared/admin-only.ts";
import { createRosterImportController } from "../controller/roster-import.controller.ts";
import { CSV_CONTENT_TYPES } from "../dto/roster-import.dto.ts";

/** Mounted at /api/admin (after requireAuth + requireRole("ADMIN")). */
export function createRosterAdminRouter(imports: RosterImportService) {
  const router = Router();
  const controller = createRosterImportController(imports);
  const csvBody = express.raw({ type: CSV_CONTENT_TYPES, limit: "1mb" });

  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(adminOnly);

  router.post(
    "/semesters/:semesterId/roster/imports",
    csvBody,
    controller.upload,
  );
  router.get("/semesters/:semesterId/roster/imports", controller.history);
  router.get("/roster/imports/:importId", controller.get);
  router.get("/roster/imports/:importId/rows", controller.rows);
  router.get("/roster/imports/:importId/missing", controller.missing);
  router.post("/roster/imports/:importId/commit", controller.commit);
  return router;
}
