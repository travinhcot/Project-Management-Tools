import type { AuthService } from "../service/auth.service.ts";
import type { AuthMiddleware } from "../middleware/auth.middleware.ts";

import { Router } from "express";
import { createAuthController } from "../controller/auth.controller.ts";
import { createAuthRateLimit } from "../middleware/rate-limit.middleware.ts";

export function createAuthRouter(service: AuthService, middleware: AuthMiddleware) {
  const router = Router();
  const controller = createAuthController(service);
  const publicLimit = createAuthRateLimit();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.post("/otp", publicLimit, controller.requestOtp);
  router.post("/verify", publicLimit, controller.verifyOtp);
  router.post("/refresh", publicLimit, controller.refresh);
  router.post("/logout", middleware.requireAuth, controller.logout);
  router.get("/me", middleware.requireAuth, controller.me);
  router.patch("/me", middleware.requireAuth, controller.updateProfile);
  return router;
}
