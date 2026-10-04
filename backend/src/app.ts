import type { AuthInterface } from "./modules/auth/interface/auth.interface.ts";
import type { UsersInterface } from "./modules/users/interface/user.interface.ts";

import express from "express";
import { HttpError, errorHandler } from "./shared/http-error.ts";

export function createApplication({
  auth,
  users,
  allowedOrigins = process.env.ALLOWED_ORIGINS || "http://localhost:5173",
}: {
  auth: AuthInterface;
  users: UsersInterface;
  allowedOrigins?: string;
}) {
  const app = express();
  app.disable("x-powered-by");
  const origins = new Set(
    allowedOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  app.use((req, res, next) => {
    const origin = req.get("origin");
    if (origin && !origins.has(origin))
      return next(
        new HttpError(403, "ORIGIN_FORBIDDEN", "This origin is not allowed."),
      );
    if (origin) {
      res.set("Access-Control-Allow-Origin", origin);
      res.vary("Origin");
      res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    }
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });
  app.use(express.json({ limit: "16kb" }));

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", auth.router);
  app.use(
    "/api/admin/users",
    auth.requireAuth,
    auth.requireRole("ADMIN"),
    users.adminRouter,
  );
  app.use((_req, _res, next) =>
    next(new HttpError(404, "NOT_FOUND", "Endpoint not found.")),
  );
  app.use(errorHandler);
  return app;
}
