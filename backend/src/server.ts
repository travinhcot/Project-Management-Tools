import type { ProjectStatsGateway } from "./modules/semesters/interface/semester.interface.ts";

import { createApplication } from "./app.ts";
import { startKeepAlive } from "./keep-alive.ts";
import { createAuthClient, getAdminClient } from "./config/database.ts";
import { createUsersInterface } from "./modules/users/interface/user.interface.ts";
import { createAuthInterface } from "./modules/auth/interface/auth.interface.ts";
import { createRosterInterface } from "./modules/roster/interface/roster.interface.ts";
import { createMembersInterface } from "./modules/members/interface/members.interface.ts";
import { createSemestersInterface } from "./modules/semesters/interface/semester.interface.ts";
import { createFilesInterface } from "./modules/files/interface/files.interface.ts";
import { createProjectsInterface } from "./modules/projects/interface/projects.interface.ts";
import { createPortalInterface } from "./modules/portal/interface/portal.interface.ts";
import { createAuditInterface } from "./modules/audit/interface/audit.interface.ts";
import { createGithubInterface } from "./modules/github/interface/github.interface.ts";
import { createDashboardInterface } from "./modules/dashboard/interface/dashboard.interface.ts";
import {
  createEmailsInterface,
  createResendEmailProvider,
} from "./modules/emails/interface/emails.interface.ts";

const adminClient = getAdminClient();
const users = createUsersInterface(adminClient);
const audit = createAuditInterface(adminClient, {
  internalSecret: process.env.INTERNAL_SECRET,
  retentionDays: process.env.AUDIT_RETENTION_DAYS
    ? Number(process.env.AUDIT_RETENTION_DAYS)
    : undefined,
});
const dashboard = createDashboardInterface(adminClient);
const auth = createAuthInterface({
  createAuthClient,
  adminClient,
  users: users.service,
  audit: audit.recorder,
});
const members = createMembersInterface(adminClient);
const roster = createRosterInterface(adminClient);
// semesters needs project counts, while projects (built below) needs semesters.service.
// The gateway resolves `projects` at call time, which breaks the construction cycle.
const projectStats: ProjectStatsGateway = {
  countProjects: (semesterId: string) => projects.stats.countProjects(semesterId),
};
const semesters = createSemestersInterface(adminClient, {
  rosterStats: members.service,
  projectStats,
});
const files = createFilesInterface(adminClient, {
  bucketId: process.env.PROJECT_FILES_BUCKET || "project-files",
  internalSecret: process.env.INTERNAL_SECRET,
});
function createEmailProvider() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return undefined; // console provider: logs instead of sending
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is required when RESEND_API_KEY is set.");
  return createResendEmailProvider({ apiKey, from });
}
const meetingLinks = {
  async meetingUrl(projectId: string): Promise<string | null> {
    const { resources } = await files.service.listForProject(projectId);
    const own = resources.find((resource) => resource.slot === "FIRST_MEETING")?.url;
    if (own) return own;
    // No link of its own: use the semester's shared kick-start link.
    const { data, error } = await adminClient.rpc("project_semester_kickoff_url", {
      p_project_id: projectId,
    });
    if (error) throw error;
    return typeof data === "string" ? data : null;
  },
};
const emails = createEmailsInterface(adminClient, {
  meetingLinks,
  provider: createEmailProvider(),
  appUrl: process.env.APP_URL || "http://localhost:5173",
  internalSecret: process.env.INTERNAL_SECRET,
  batchSize: process.env.EMAIL_BATCH_SIZE
    ? Number(process.env.EMAIL_BATCH_SIZE)
    : undefined,
});
const projects = createProjectsInterface(adminClient, {
  semesters: semesters.service,
  roster: members.service,
  resources: files.service,
  kickoffs: emails.kickoffs,
});
const portal = createPortalInterface(
  adminClient,
  { resources: files.service, meetingUrl: meetingLinks.meetingUrl },
  { allowPastSemesters: process.env.PORTAL_PAST_SEMESTERS === "true" },
);
const github = createGithubInterface(
  adminClient,
  {
    // Same access rule as the member portal: an active assignment to the project.
    async memberCanView(actorId, projectId) {
      const { data, error } = await adminClient.rpc("member_get_project", {
        p_actor_id: actorId,
        p_project_id: projectId,
        p_include_past: true,
      });
      if (error) throw error;
      return Array.isArray(data) && data.length > 0;
    },
  },
  {
    token: process.env.GITHUB_TOKEN || undefined,
    internalSecret: process.env.INTERNAL_SECRET,
    staleMinutes: process.env.GITHUB_STALE_MINUTES
      ? Number(process.env.GITHUB_STALE_MINUTES)
      : undefined,
  },
);
const app = createApplication({
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
});
// In-process scheduler: sends due campaigns every minute.
// Set EMAIL_SCHEDULER=off when an external cron calls /api/internal/campaigns/process.
if (process.env.EMAIL_SCHEDULER !== "off") {
  let running = false;
  setInterval(() => {
    if (running) return;
    running = true;
    emails.processor
      .processDue()
      .catch((error: unknown) => console.error("Email processor failed:", error))
      .finally(() => {
        running = false;
      });
  }, 60_000).unref();
}
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid PORT.");
app.listen(port, (error?: Error) => {
  if (error) {
    console.error("Failed to start backend:", error);
    process.exit(1);
  }
  console.log(`Backend listening on http://localhost:${port}`);
  startKeepAlive();
});
