import type { RosterMemberService } from "../service/roster-member.service.ts";

import { Router } from "express";
import { adminOnly } from "../../../shared/admin-only.ts";
import { createRosterMemberController } from "../controller/roster-member.controller.ts";

/** Mounted at /api/admin (after requireAuth + requireRole("ADMIN")). */
export function createMemberAdminRouter(members: RosterMemberService) {
  const router = Router();
  const controller = createRosterMemberController(members);

  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(adminOnly);

  router.get("/semesters/:semesterId/roster", controller.list);
  router.post("/semesters/:semesterId/roster", controller.add);
  router.patch("/roster/:rosterMemberId", controller.update);
  return router;
}
