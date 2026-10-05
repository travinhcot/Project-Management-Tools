import type { ProjectService } from "../service/project.service.ts";
import type { ProjectMemberService } from "../service/project-member.service.ts";

import { Router } from "express";
import { adminOnly } from "../../../shared/admin-only.ts";
import { createProjectAdminController } from "../controller/project-admin.controller.ts";
import { createProjectMemberController } from "../controller/project-member.controller.ts";

/** Mounted at /api/admin/projects (after requireAuth + requireRole("ADMIN")). */
export function createProjectAdminRouter(
  service: ProjectService,
  memberService: ProjectMemberService,
) {
  const router = Router();
  const controller = createProjectAdminController(service);
  const memberController = createProjectMemberController(memberService);
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
  router.post("/:projectId/members", memberController.assign);
  router.patch(
    "/:projectId/members/:rosterMemberId",
    memberController.setRole,
  );
  router.delete(
    "/:projectId/members/:rosterMemberId",
    memberController.remove,
  );
  return router;
}
