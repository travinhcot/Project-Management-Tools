import type { AuthService } from "../service/auth.service.ts";
import type { AuthMiddleware } from "../middleware/auth.middleware.ts";

import { Router } from "express";
import { createAuthController } from "../controller/auth.controller.ts";
import { createAuthRateLimit } from "../middleware/rate-limit.middleware.ts";

export function createAuthRouter(service: AuthService, middleware: AuthMiddleware) {
  const router = Router();
  const controller = createAuthController(service);
  const rateLimit = createAuthRateLimit();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  // Limit only the unauthenticated endpoints; signed-in calls like /me are already gated.
  router.post("/otp", rateLimit, controller.requestOtp);
  router.post("/verify", rateLimit, controller.verifyOtp);
  router.post("/refresh", rateLimit, controller.refresh);
  router.post("/logout", middleware.requireAuth, controller.logout);
  router.get("/me", middleware.requireAuth, controller.me);
  router.patch("/me", middleware.requireAuth, controller.updateProfile);
  return router;
}
