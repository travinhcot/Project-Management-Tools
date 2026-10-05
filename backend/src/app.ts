import type { AuthInterface } from "./modules/auth/interface/auth.interface.ts";
import type { UsersInterface } from "./modules/users/interface/user.interface.ts";
import type { SemestersInterface } from "./modules/semesters/interface/semester.interface.ts";
import type { RosterInterface } from "./modules/roster/interface/roster.interface.ts";
import type { MembersInterface } from "./modules/members/interface/members.interface.ts";
import type { ProjectsInterface } from "./modules/projects/interface/projects.interface.ts";

import express from "express";
import { HttpError, errorHandler } from "./shared/http-error.ts";

export function createApplication({
  auth,
  users,
  semesters,
  roster,
  members,
  projects,
  allowedOrigins = process.env.ALLOWED_ORIGINS || "http://localhost:5173",
}: {
  auth: AuthInterface;
  users: UsersInterface;
  semesters: SemestersInterface;
  roster: RosterInterface;
  members: MembersInterface;
  projects: ProjectsInterface;
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
      res.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PATCH, DELETE, OPTIONS",
      );
    }
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });
  app.use(express.json({ limit: "16kb" }));

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", auth.router);
  // Authenticate once for the whole admin area, then mount each module's router.
  const admin = express.Router();
  admin.use(auth.requireAuth, auth.requireRole("ADMIN"));
  admin.use("/users", users.adminRouter);
  admin.use("/semesters", semesters.adminRouter);
  admin.use("/projects", projects.adminRouter);
  admin.use(members.adminRouter); // /semesters/:id/roster, /roster/:rosterMemberId
  admin.use(roster.adminRouter); // /semesters/:id/roster/imports, /roster/imports/...
  app.use("/api/admin", admin);
  app.use((_req, _res, next) =>
    next(new HttpError(404, "NOT_FOUND", "Endpoint not found.")),
  );
  app.use(errorHandler);
  return app;
}
