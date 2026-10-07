// Trusted bootstrap: gives every roster member who is not linked yet a way to sign in.
// For each ACTIVE roster member without a user_id it
//   1. finds or creates the Supabase Auth user (email pre-confirmed, so the OTP email works),
//   2. finds or creates the app_users profile with role MEMBER (never ADMIN),
//   3. sets roster_members.user_id.
// Safe to re-run: members that are already linked are skipped, and nothing existing is changed.
//
// Usage:
//   node src/scripts/provision-roster.ts                      dry run for the current semester
//   node src/scripts/provision-roster.ts --apply              do it
//   node src/scripts/provision-roster.ts --semester <uuid>    another semester
import { getAdminClient } from "../config/database.ts";
import { createUsersInterface } from "../modules/users/interface/user.interface.ts";
import { HttpError } from "../shared/http-error.ts";
import { emailProblem, normalizeEmail } from "../shared/roster-rules.ts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const semesterFlag = args.indexOf("--semester");
const semesterArg = semesterFlag >= 0 ? args[semesterFlag + 1] : undefined;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (semesterFlag >= 0 && !UUID.test(semesterArg ?? "")) {
  throw new Error("Usage: node src/scripts/provision-roster.ts [--apply] [--semester <uuid>]");
}

const client = getAdminClient();
const users = createUsersInterface(client).service;

interface RosterRow {
  id: string;
  email: string;
  full_name: string;
}

async function pickSemester(): Promise<{ id: string; name: string }> {
  const query = client.from("semesters").select("id,name");
  const { data, error } = semesterArg
    ? await query.eq("id", semesterArg).maybeSingle()
    : await query.eq("is_current", true).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(semesterArg ? "Semester not found." : "No current semester is set.");
  return data;
}

async function unlinkedMembers(semesterId: string): Promise<RosterRow[]> {
  const rows: RosterRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from("roster_members")
      .select("id,email,full_name")
      .eq("semester_id", semesterId)
      .eq("status", "ACTIVE")
      .is("user_id", null)
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

/** Every Auth user, keyed by lower-cased email. */
async function authUsersByEmail() {
  const byEmail = new Map<string, { id: string; confirmed: boolean }>();
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email) {
        byEmail.set(normalizeEmail(user.email), {
          id: user.id,
          confirmed: Boolean(user.email_confirmed_at),
        });
      }
    }
    if (data.users.length < 1000) return byEmail;
  }
}

async function profilesByEmail() {
  const byEmail = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from("app_users")
      .select("id,normalized_email")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    for (const profile of data ?? []) byEmail.set(profile.normalized_email, profile.id);
    if ((data ?? []).length < 1000) return byEmail;
  }
}

const semester = await pickSemester();
const members = await unlinkedMembers(semester.id);
const authByEmail = await authUsersByEmail();
const profileByEmail = await profilesByEmail();

console.log(
  `${apply ? "APPLYING" : "DRY RUN"} for ${semester.name}: ${members.length} active roster member(s) without an account link.`,
);

const counts = { authCreated: 0, profileCreated: 0, linked: 0, skipped: 0, failed: 0 };

for (const member of members) {
  const email = normalizeEmail(member.email);
  const label = `${member.full_name} <${email}>`;
  try {
    if (emailProblem(email)) {
      counts.skipped += 1;
      console.log(`  skip    ${label}: invalid email`);
      continue;
    }

    let auth = authByEmail.get(email);
    const needsAuth = !auth;
    const needsConfirm = Boolean(auth && !auth.confirmed);
    const needsProfile = !profileByEmail.has(email);
    if (!apply) {
      console.log(
        `  would   ${label}: ${[needsAuth && "create Auth user", needsConfirm && "confirm email", needsProfile && "create profile", "link roster"].filter(Boolean).join(", ")}`,
      );
      continue;
    }

    if (!auth) {
      const { data, error } = await client.auth.admin.createUser({ email, email_confirm: true });
      if (error || !data.user) throw error ?? new Error("Auth user was not created.");
      auth = { id: data.user.id, confirmed: true };
      authByEmail.set(email, auth);
      counts.authCreated += 1;
    } else if (!auth.confirmed) {
      const { error } = await client.auth.admin.updateUserById(auth.id, { email_confirm: true });
      if (error) throw error;
      auth.confirmed = true;
    }

    let profileId = profileByEmail.get(email);
    if (!profileId) {
      const profile = await users.provisionVerifiedProfile(
        { id: auth.id, email, email_verified_at: new Date().toISOString() },
        member.full_name,
        "MEMBER",
      );
      profileId = profile.id;
      profileByEmail.set(email, profileId);
      counts.profileCreated += 1;
    }

    // Link this person's roster entries in every semester (the database checks the emails match).
    const { error: linkError } = await client
      .from("roster_members")
      .update({ user_id: profileId })
      .eq("normalized_email", email)
      .is("user_id", null);
    if (linkError) throw linkError;
    counts.linked += 1;
    console.log(`  linked  ${label}`);
  } catch (error) {
    counts.failed += 1;
    const reason =
      error instanceof HttpError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? error.message
          : JSON.stringify(error);
    console.log(`  FAILED  ${label}: ${reason}`);
  }
}

console.log(
  apply
    ? `Done. Auth users created: ${counts.authCreated}, profiles created: ${counts.profileCreated}, linked: ${counts.linked}, skipped: ${counts.skipped}, failed: ${counts.failed}.`
    : `Dry run only. Run again with --apply to make these changes. Skipped: ${counts.skipped}.`,
);
if (counts.failed > 0) process.exitCode = 1;
