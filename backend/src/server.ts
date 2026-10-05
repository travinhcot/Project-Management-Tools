import { createApplication } from "./app.ts";
import { createAuthClient, getAdminClient } from "./config/database.ts";
import { createUsersInterface } from "./modules/users/interface/user.interface.ts";
import { createAuthInterface } from "./modules/auth/interface/auth.interface.ts";
import { createRosterInterface } from "./modules/roster/interface/roster.interface.ts";
import { createMembersInterface } from "./modules/members/interface/members.interface.ts";
import { createSemestersInterface } from "./modules/semesters/interface/semester.interface.ts";
import { createFilesInterface } from "./modules/files/interface/files.interface.ts";
import { createProjectsInterface } from "./modules/projects/interface/projects.interface.ts";

const adminClient = getAdminClient();
const users = createUsersInterface(adminClient);
const auth = createAuthInterface({
  createAuthClient,
  adminClient,
  users: users.service,
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
const projects = createProjectsInterface(adminClient, {
  semesters: semesters.service,
  roster: members.service,
  resources: files.service,
  // kickoffs: emails.kickoffs     - add with the emails module
});
const app = createApplication({
  auth,
  users,
  semesters,
  roster,
  members,
  projects,
  files,
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
