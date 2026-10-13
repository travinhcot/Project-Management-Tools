// Explicit trusted bootstrap; never called by a public registration endpoint.
import type {
  DepartmentCode,
  UserRole,
} from "../modules/users/interface/user.interface.ts";

import { getAdminClient } from "../config/database.ts";
import {
  DEPARTMENT_CODES,
  USER_ROLES,
  createUsersInterface,
} from "../modules/users/interface/user.interface.ts";

const USAGE =
  'Usage: node src/scripts/provision-user.ts <auth-user-uuid> "<full name>" [MEMBER|DEPT_ADMIN|ADMIN] [TECH|MARCOM|HR]\n' +
  "ADMIN has no department; DEPT_ADMIN needs one; a MEMBER defaults to TECH.";

const [id, fullName, role = "MEMBER", department] = process.argv.slice(2);
if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id || "",
  ) ||
  !fullName?.trim() ||
  [...fullName.trim()].length > 200 ||
  !USER_ROLES.includes(role as UserRole) ||
  (role === "ADMIN" && department !== undefined) ||
  (role === "DEPT_ADMIN" && department === undefined) ||
  (department !== undefined &&
    !DEPARTMENT_CODES.includes(department as DepartmentCode))
) {
  throw new Error(USAGE);
}
const client = getAdminClient();
const { data, error } = await client.auth.admin.getUserById(id);
if (error || !data.user?.email || !data.user.email_confirmed_at) {
  throw new Error(
    "Provisioning requires an existing, verified Supabase Auth user.",
  );
}
await createUsersInterface(client).service.provisionVerifiedProfile(
  {
    id,
    email: data.user.email,
    email_verified_at: data.user.email_confirmed_at,
  },
  fullName!,
  role as UserRole,
  department as DepartmentCode | undefined,
);
console.log("Application profile provisioned.");
