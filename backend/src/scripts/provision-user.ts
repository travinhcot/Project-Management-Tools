// Explicit trusted bootstrap; never called by a public registration endpoint.
import { getAdminClient } from "../config/database.ts";
import { createUsersInterface } from "../modules/users/interface/user.interface.ts";

const [id, fullName, role = "MEMBER"] = process.argv.slice(2);
if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id || "",
  ) ||
  !fullName?.trim() ||
  [...fullName.trim()].length > 200 ||
  !["ADMIN", "MEMBER"].includes(role)
) {
  throw new Error(
    'Usage: node src/scripts/provision-user.ts <auth-user-uuid> "<full name>" [MEMBER|ADMIN]',
  );
}
const client = getAdminClient();
const { data, error } = await client.auth.admin.getUserById(id);
if (error || !data.user?.email || !data.user.email_confirmed_at) {
  throw new Error(
    "Provisioning requires an existing, verified Supabase Auth user.",
  );
}
await createUsersInterface(client).provisionVerifiedProfile({
  id,
  email: data.user.email,
  email_verified_at: data.user.email_confirmed_at,
}, fullName!, role as "ADMIN" | "MEMBER");
console.log("Application profile provisioned.");
