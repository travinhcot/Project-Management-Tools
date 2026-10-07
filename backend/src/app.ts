import type { AuthInterface } from "./modules/auth/interface/auth.interface.ts";
import type { UsersInterface } from "./modules/users/interface/user.interface.ts";
import type { SemestersInterface } from "./modules/semesters/interface/semester.interface.ts";
import type { RosterInterface } from "./modules/roster/interface/roster.interface.ts";
import type { MembersInterface } from "./modules/members/interface/members.interface.ts";
import type { ProjectsInterface } from "./modules/projects/interface/projects.interface.ts";
import type { FilesInterface } from "./modules/files/interface/files.interface.ts";
import type { PortalInterface } from "./modules/portal/interface/portal.interface.ts";
import type { EmailsInterface } from "./modules/emails/interface/emails.interface.ts";
import type { AuditInterface } from "./modules/audit/interface/audit.interface.ts";
import type { DashboardInterface } from "./modules/dashboard/interface/dashboard.interface.ts";
import type { GithubInterface } from "./modules/github/interface/github.interface.ts";

import express from "express";
import { HttpError, errorHandler } from "./shared/http-error.ts";

export function createApplication({
  auth,
  users,
  semesters,
  roster,
  members,
  projects,
  files,
  portal,
  emails,
  audit,
  dashboard,
  github,
  allowedOrigins = process.env.ALLOWED_ORIGINS || "http://localhost:5173",
}: {
  auth: AuthInterface;
  users: UsersInterface;
  semesters: SemestersInterface;
  roster: RosterInterface;
  members: MembersInterface;
  projects: ProjectsInterface;
  files: FilesInterface;
  portal: PortalInterface;
  emails: EmailsInterface;
  audit: AuditInterface;
  dashboard: DashboardInterface;
  github: GithubInterface;
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
        "GET, POST, PUT, PATCH, DELETE, OPTIONS",
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
  admin.use("/projects", files.adminRouter); // /projects/:id/resources, /projects/:id/files
  admin.use("/projects", github.adminRouter); // /projects/:id/github, /projects/:id/github/refresh
  admin.use(members.adminRouter); // /semesters/:id/roster, /roster/:rosterMemberId
  admin.use(roster.adminRouter); // /semesters/:id/roster/imports, /roster/imports/...
  admin.use(emails.adminRouter); // /projects/:id/kickoff-campaign, /semesters/:id/demo-campaign, /campaigns/...
  admin.use("/audit-events", audit.adminRouter);
  admin.use("/dashboard", dashboard.adminRouter);
  app.use("/api/admin", admin);
  app.use(
    "/api/me",
    auth.requireAuth,
    auth.requireRole("MEMBER"),
    portal.memberRouter, // GET /, /projects, /projects/:id, /overview, /profile, /notifications/badge
    files.memberRouter, // POST /projects/:id/files/:fileId/download-url
    github.memberRouter, // GET /projects/:id/github
  );
  app.use(
    "/api/internal",
    files.internalRouter,
    emails.internalRouter,
    audit.internalRouter, // POST /audit/retention
    github.internalRouter, // POST /github/refresh-all
  );
  app.use((_req, _res, next) =>
    next(new HttpError(404, "NOT_FOUND", "Endpoint not found.")),
  );
  app.use(errorHandler);
  return app;
}
