import type { AuthService } from "../service/auth.service.ts";
import type { AuthMiddleware } from "../middleware/auth.middleware.ts";

import { Router } from "express";
import { createAuthController } from "../controller/auth.controller.ts";

export function createAuthRouter(service: AuthService, middleware: AuthMiddleware) {
  const router = Router();
  const controller = createAuthController(service);
  // TODO: re-add the auth rate limiter (middleware/rate-limit.middleware.ts) after testing.
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.post("/otp", controller.requestOtp);
  router.post("/verify", controller.verifyOtp);
  router.post("/refresh", controller.refresh);
  router.post("/logout", middleware.requireAuth, controller.logout);
  router.get("/me", middleware.requireAuth, controller.me);
  router.patch("/me", middleware.requireAuth, controller.updateProfile);
  return router;
}
