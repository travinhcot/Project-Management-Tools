import type { UsersService } from "../service/user.service.ts";

import { Router } from "express";
import { adminOnly } from "../../../shared/admin-only.ts";
import { createUserAdminController } from "../controller/user-admin.controller.ts";

export function createUserAdminRouter(service: UsersService) {
  const router = Router();
  const controller = createUserAdminController(service);
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(adminOnly);
  router.get("/", controller.list);
  router.patch("/:userId", controller.updateAccess);
  return router;
}
