import type { PortalService } from "../service/portal.service.ts";

import { Router } from "express";
import { createPortalController } from "../controller/portal.controller.ts";

/** Mounted at /api/me (after requireAuth + requireRole("MEMBER")). Eligibility is checked per request in SQL. */
export function createPortalMemberRouter(service: PortalService) {
  const router = Router();
  const controller = createPortalController(service);
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.get("/", controller.status);
  router.get("/overview", controller.overview);
  router.get("/profile", controller.profile);
  router.get("/projects", controller.listProjects);
  router.get("/projects/:projectId", controller.getProject);
  router.get("/notifications/badge", controller.badge);
  return router;
}
