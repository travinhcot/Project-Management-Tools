// Trusted bootstrap: turn an existing account into the admin of one department (or back).
//   node src/scripts/assign-department.ts <email> <TECH|MARCOM|HR>            -> DEPT_ADMIN of that department
//   node src/scripts/assign-department.ts <email> <TECH|MARCOM|HR> --member   -> MEMBER of that department
//   node src/scripts/assign-department.ts <email> ADMIN                       -> EB super-admin (all departments)
// Refuses to demote the last active ADMIN. The user's next page load picks the new role up.
import type { DepartmentCode } from "../modules/users/interface/user.interface.ts";

import { getAdminClient } from "../config/database.ts";
import { DEPARTMENT_CODES } from "../modules/users/interface/user.interface.ts";

const [emailArg, target, flag] = process.argv.slice(2);
const asMember = flag === "--member";
const email = emailArg?.trim().toLowerCase();
const toAdmin = target === "ADMIN";
if (
  !email ||
  !email.includes("@") ||
  (!toAdmin && !DEPARTMENT_CODES.includes(target as DepartmentCode))
) {
  throw new Error(
    "Usage: node src/scripts/assign-department.ts <email> <TECH|MARCOM|HR|ADMIN> [--member]",
  );
}

const client = getAdminClient();
const { data: user, error: userError } = await client
  .from("app_users")
  .select("id,role,is_active,department_id")
  .eq("normalized_email", email)
  .maybeSingle();
if (userError) throw userError;
if (!user) throw new Error(`No application profile for ${email}.`);

let departmentId: string | null = null;
if (!toAdmin) {
  const { data: department, error } = await client
    .from("departments")
    .select("id")
    .eq("code", target)
    .single();
  if (error) throw error;
  departmentId = department.id;
}

if (user.role === "ADMIN" && user.is_active && !toAdmin) {
  const { count, error } = await client
    .from("app_users")
    .select("id", { count: "exact", head: true })
    .eq("role", "ADMIN")
    .eq("is_active", true)
    .neq("id", user.id);
  if (error) throw error;
  if (!count) {
    throw new Error(
      "This is the last active ADMIN. Promote another super-admin first, otherwise nobody can manage users.",
    );
  }
}

// ADMIN has no department; a MEMBER and a DEPT_ADMIN each have the one they were given.
const role = toAdmin ? "ADMIN" : asMember ? "MEMBER" : "DEPT_ADMIN";
const { error: updateError } = await client
  .from("app_users")
  .update({ role, department_id: departmentId })
  .eq("id", user.id);
if (updateError) throw updateError;

const { error: auditError } = await client.from("audit_events").insert({
  actor_user_id: null,
  action: "USER_ROLE_CHANGED",
  entity_type: "APP_USER",
  entity_id: user.id,
  metadata: { before: user.role, after: role, after_department: toAdmin ? null : target, via: "script" },
});
if (auditError) console.warn("Role updated, but the audit event could not be written.");

console.log(`${email} is now ${toAdmin ? "ADMIN" : asMember ? `MEMBER (${target})` : `DEPT_ADMIN (${target})`}.`);
