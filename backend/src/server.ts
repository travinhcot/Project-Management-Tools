import { createApplication } from "./app.ts";
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
const semesters = createSemestersInterface(adminClient, {
  rosterStats: members.service,
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
const emails = createEmailsInterface(adminClient, {
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
  { resources: files.service },
  { allowPastSemesters: process.env.PORTAL_PAST_SEMESTERS === "true" },
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
});
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid PORT.");
app.listen(port, (error?: Error) => {
  if (error) {
    console.error("Failed to start backend:", error);
    process.exit(1);
  }
  console.log(`Backend listening on http://localhost:${port}`);
});
