// Trusted bootstrap: gives every roster member who is not linked yet a way to sign in.
// Roster imports now do this automatically on commit; use this to repair older imports.
// For each ACTIVE roster member without a user_id it
//   1. finds or creates the Supabase Auth user (email pre-confirmed, so the OTP email works),
//   2. finds or creates the app_users profile with role MEMBER in the roster entry's department,
//   3. sets roster_members.user_id.
// Safe to re-run: members that are already linked are skipped, and nothing existing is changed.
//
// Usage:
//   node src/scripts/provision-roster.ts                      dry run for the current semester
//   node src/scripts/provision-roster.ts --apply              do it
//   node src/scripts/provision-roster.ts --semester <uuid>    another semester
import { getAdminClient } from "../config/database.ts";
import { createRosterInterface } from "../modules/roster/interface/roster.interface.ts";
import { createUsersInterface } from "../modules/users/interface/user.interface.ts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const semesterFlag = args.indexOf("--semester");
const semesterArg = semesterFlag >= 0 ? args[semesterFlag + 1] : undefined;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (semesterFlag >= 0 && !UUID.test(semesterArg ?? "")) {
  throw new Error("Usage: node src/scripts/provision-roster.ts [--apply] [--semester <uuid>]");
}

const client = getAdminClient();
const { provisioning } = createRosterInterface(client, {
  profiles: createUsersInterface(client).service,
});

async function pickSemester(): Promise<{ id: string; name: string }> {
  const query = client.from("semesters").select("id,name");
  const { data, error } = semesterArg
    ? await query.eq("id", semesterArg).maybeSingle()
    : await query.eq("is_current", true).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(semesterArg ? "Semester not found." : "No current semester is set.");
  return data;
}

const semester = await pickSemester();
const members = await provisioning.unlinkedForSemester(semester.id);

console.log(
  `${apply ? "APPLYING" : "DRY RUN"} for ${semester.name}: ${members.length} active roster member(s) without an account link.`,
);

const results = await provisioning.provisionMembers(members, { dryRun: !apply });
for (const result of results) {
  console.log(`  ${result.status.padEnd(7)} ${result.full_name} <${result.email}>: ${result.detail}`);
}

const count = (status: string) => results.filter((result) => result.status === status).length;
console.log(
  apply
    ? `Done. Linked: ${count("linked")}, skipped: ${count("skipped")}, failed: ${count("failed")}.`
    : `Dry run only. Run again with --apply to make these changes. Skipped: ${count("skipped")}.`,
);
if (count("failed") > 0) process.exitCode = 1;
