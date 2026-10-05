import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";

const envPath = fileURLToPath(new URL("../../../.env.local", import.meta.url));
config({ path: envPath, quiet: true });

/**
 * Dept Tech Project Management seed script
 *
 * Run from the backend folder:
 *   ALLOW_SEED=true npm run seed
 *
 * Required env:
 *   SUPABASE_URL=...
 *   SUPABASE_SECRET_KEY=... (or SUPABASE_SERVICE_ROLE_KEY)
 *   ALLOW_SEED=true
 *
 * Optional env:
 *   PROJECT_FILES_BUCKET=project-files
 *   SEED_PASSWORD=SeedOnly123!
 *
 * IMPORTANT: use only against a local/dev/test Supabase project.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const serverKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const FILE_BUCKET = process.env.PROJECT_FILES_BUCKET ?? "project-files";
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "SeedOnly123!";

if (!SUPABASE_URL || !serverKey) {
  throw new Error(
    "Missing SUPABASE_URL and backend SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY",
  );
}

if (process.env.ALLOW_SEED !== "true") {
  throw new Error(
    "Refusing to seed. Set ALLOW_SEED=true only for a local/dev/test database.",
  );
}

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed while NODE_ENV=production");
}
const supabase: SupabaseClient = createClient(SUPABASE_URL, serverKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const IDS = {
  semesterPrevious: "10000000-0000-4000-8000-000000000001",
  semesterActive: "10000000-0000-4000-8000-000000000002",

  importActive: "20000000-0000-4000-8000-000000000001",

  rosterAdmin: "30000000-0000-4000-8000-000000000001",
  rosterAlice: "30000000-0000-4000-8000-000000000002",
  rosterBob: "30000000-0000-4000-8000-000000000003",
  rosterCharlie: "30000000-0000-4000-8000-000000000004",
  rosterUnlinked: "30000000-0000-4000-8000-000000000005",

  softwareProject: "40000000-0000-4000-8000-000000000001",
  hardwareProject: "40000000-0000-4000-8000-000000000002",
  archivedProject: "40000000-0000-4000-8000-000000000003",

  projectMemberAlice: "50000000-0000-4000-8000-000000000001",
  projectMemberBob: "50000000-0000-4000-8000-000000000002",
  projectMemberCharlie: "50000000-0000-4000-8000-000000000003",

  fileSoftwareSrs: "60000000-0000-4000-8000-000000000001",
  fileSoftwareTemplate: "60000000-0000-4000-8000-000000000002",
  fileHardwareSrs: "60000000-0000-4000-8000-000000000003",
  fileHardwareBom: "60000000-0000-4000-8000-000000000004",

  kickoffCampaign: "70000000-0000-4000-8000-000000000001",
  demoCampaign: "70000000-0000-4000-8000-000000000002",

  deliveryKickoffAlice: "80000000-0000-4000-8000-000000000001",
  deliveryKickoffBob: "80000000-0000-4000-8000-000000000002",
  deliveryDemoAlice: "80000000-0000-4000-8000-000000000003",
  deliveryDemoBob: "80000000-0000-4000-8000-000000000004",
  deliveryDemoCharlie: "80000000-0000-4000-8000-000000000005",

  auditSemester: "90000000-0000-4000-8000-000000000001",
  auditSoftwareProject: "90000000-0000-4000-8000-000000000002",
  auditAssignment: "90000000-0000-4000-8000-000000000003",
  auditCampaign: "90000000-0000-4000-8000-000000000004",
} as const;

const SEED_USERS = [
  {
    email: "admin.depttech@example.com",
    fullName: "Dept Tech Admin",
    role: "ADMIN" as const,
  },
  {
    email: "alice.nguyen@example.com",
    fullName: "Alice Nguyen",
    role: "MEMBER" as const,
  },
  {
    email: "bob.tran@example.com",
    fullName: "Bob Tran",
    role: "MEMBER" as const,
  },
  {
    email: "charlie.le@example.com",
    fullName: "Charlie Le",
    role: "MEMBER" as const,
  },
];

function iso(value: string): string {
  return new Date(value).toISOString();
}

async function must<T>(
  promise: PromiseLike<{ data: T; error: { message: string } | null }>,
  label: string,
): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function findAuthUserByEmail(
  client: SupabaseClient,
  email: string,
): Promise<User | null> {
  // Sufficient for a test project. If your test Auth project contains >1000 users,
  // replace this with paginated lookup.
  const { data, error } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) throw new Error(`List auth users: ${error.message}`);

  return (
    data.users.find(
      (user) => user.email?.trim().toLowerCase() === email.toLowerCase(),
    ) ?? null
  );
}

async function ensureAuthUser(
  client: SupabaseClient,
  input: { email: string; fullName: string; role: "ADMIN" | "MEMBER" },
): Promise<User> {
  const existing = await findAuthUserByEmail(client, input.email);
  if (existing) return existing;

  const { data, error } = await client.auth.admin.createUser({
    email: input.email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
      seed_account: true,
    },
  });

  if (error) throw new Error(`Create auth user ${input.email}: ${error.message}`);
  return data.user;
}

async function ensurePrivateBucket(client: SupabaseClient): Promise<void> {
  const { data: buckets, error: listError } = await client.storage.listBuckets();
  if (listError) throw new Error(`List storage buckets: ${listError.message}`);

  if (!buckets.some((bucket) => bucket.id === FILE_BUCKET)) {
    const { error } = await client.storage.createBucket(FILE_BUCKET, {
      public: false,
    });
    if (error) throw new Error(`Create bucket ${FILE_BUCKET}: ${error.message}`);
  }
}

async function uploadSeedFile(
  client: SupabaseClient,
  path: string,
  body: string,
  contentType: string,
): Promise<number> {
  const bytes = new TextEncoder().encode(body);
  const { error } = await client.storage.from(FILE_BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Upload ${path}: ${error.message}`);
  return bytes.byteLength;
}

async function main() {
  console.log("Seeding Dept Tech Project Management test data...");

  // ---------------------------------------------------------------------------
  // 1. Supabase Auth + app_users
  // ---------------------------------------------------------------------------
  const authUsers = new Map<string, User>();
  for (const seedUser of SEED_USERS) {
    const user = await ensureAuthUser(supabase, seedUser);
    authUsers.set(seedUser.email, user);
  }

  const admin = authUsers.get("admin.depttech@example.com")!;
  const alice = authUsers.get("alice.nguyen@example.com")!;
  const bob = authUsers.get("bob.tran@example.com")!;
  const charlie = authUsers.get("charlie.le@example.com")!;

  await must(
    supabase.from("app_users").upsert(
      SEED_USERS.map((seedUser) => {
        const authUser = authUsers.get(seedUser.email)!;
        return {
          id: authUser.id,
          email: seedUser.email,
          normalized_email: seedUser.email.trim().toLowerCase(),
          full_name: seedUser.fullName,
          role: seedUser.role,
          is_active: true,
        };
      }),
      { onConflict: "id" },
    ),
    "Seed app_users",
  );

  // ---------------------------------------------------------------------------
  // 2. Semesters
  // The schema permits at most one current semester. For a dedicated test DB,
  // un-flag the existing one first so the seed's current semester can be set.
  // ---------------------------------------------------------------------------
  await must(
    supabase.from("semesters").update({ is_current: false }).eq("is_current", true),
    "Unset current semester",
  );

  // name is generated by the database from term + year ("Sem A 2026").
  await must(
    supabase.from("semesters").upsert(
      [
        {
          id: IDS.semesterPrevious,
          term: "A",
          year: 2026,
          is_current: false,
          demo_registration_url: "https://example.com/demo/semester-a-2026",
        },
        {
          id: IDS.semesterActive,
          term: "B",
          year: 2026,
          is_current: true,
          demo_registration_url: "https://example.com/demo/semester-b-2026",
        },
      ],
      { onConflict: "id" },
    ),
    "Seed semesters",
  );

  // ---------------------------------------------------------------------------
  // 3. Roster import + semester members
  // ---------------------------------------------------------------------------
  await must(
    supabase.from("roster_imports").upsert(
      {
        id: IDS.importActive,
        semester_id: IDS.semesterActive,
        initiated_by_user_id: admin.id,
        filename: "semester-b-2026-members-seed.csv",
        file_checksum: "seed:semester-b-2026:v1",
        status: "COMMITTED",
        total_rows: 5,
        valid_rows: 5,
        invalid_rows: 0,
        error_summary: null,
        committed_at: iso("2026-08-01T09:02:00+07:00"),
      },
      { onConflict: "id" },
    ),
    "Seed roster_imports",
  );

  await must(
    supabase.from("roster_members").upsert(
      [
        {
          id: IDS.rosterAdmin,
          semester_id: IDS.semesterActive,
          user_id: admin.id,
          email: "admin.depttech@example.com",
          normalized_email: "admin.depttech@example.com",
          full_name: "Dept Tech Admin",
          other_info: { student_id: "ADMIN-SEED", track: "Management" },
          status: "ACTIVE",
        },
        {
          id: IDS.rosterAlice,
          semester_id: IDS.semesterActive,
          user_id: alice.id,
          email: "alice.nguyen@example.com",
          normalized_email: "alice.nguyen@example.com",
          full_name: "Alice Nguyen",
          other_info: { student_id: "S4000001", track: "Software" },
          status: "ACTIVE",
        },
        {
          id: IDS.rosterBob,
          semester_id: IDS.semesterActive,
          user_id: bob.id,
          email: "bob.tran@example.com",
          normalized_email: "bob.tran@example.com",
          full_name: "Bob Tran",
          other_info: { student_id: "S4000002", track: "Software" },
          status: "ACTIVE",
        },
        {
          id: IDS.rosterCharlie,
          semester_id: IDS.semesterActive,
          user_id: charlie.id,
          email: "charlie.le@example.com",
          normalized_email: "charlie.le@example.com",
          full_name: "Charlie Le",
          other_info: { student_id: "S4000003", track: "Hardware" },
          status: "ACTIVE",
        },
        {
          id: IDS.rosterUnlinked,
          semester_id: IDS.semesterActive,
          user_id: null,
          email: "not-signed-in-yet@example.com",
          normalized_email: "not-signed-in-yet@example.com",
          full_name: "Unlinked Seed Member",
          other_info: { student_id: "S4000004", track: "Hardware" },
          status: "ACTIVE",
        },
      ],
      { onConflict: "id" },
    ),
    "Seed roster_members",
  );

  // ---------------------------------------------------------------------------
  // 4. Projects
  // ---------------------------------------------------------------------------
  await must(
    supabase.from("projects").upsert(
      [
        {
          id: IDS.softwareProject,
          semester_id: IDS.semesterActive,
          name: "NCT Member Portal - Seed",
          type: "SOFTWARE",
          description: "Seed project for backend API testing.",
          created_by_user_id: admin.id,
          srs_external_url: null,
          first_meeting_url: "https://meet.google.com/example-software-seed",
          bom_external_url: null,
          archived_at: null,
        },
        {
          id: IDS.hardwareProject,
          semester_id: IDS.semesterActive,
          name: "Smart Attendance Device - Seed",
          type: "HARDWARE",
          description: "Seed hardware project for backend API testing.",
          created_by_user_id: admin.id,
          srs_external_url: null,
          first_meeting_url: "https://meet.google.com/example-hardware-seed",
          bom_external_url: null,
          archived_at: null,
        },
        {
          id: IDS.archivedProject,
          semester_id: IDS.semesterActive,
          name: "Archived Prototype - Seed",
          type: "SOFTWARE",
          description: "Archived seed project.",
          created_by_user_id: admin.id,
          srs_external_url: "https://example.com/srs/archived-seed",
          first_meeting_url: "https://meet.google.com/example-archived-seed",
          bom_external_url: null,
          archived_at: iso("2026-09-15T12:00:00+07:00"),
        },
      ],
      { onConflict: "id" },
    ),
    "Seed projects",
  );

  // ---------------------------------------------------------------------------
  // 5. Project assignments
  // ---------------------------------------------------------------------------
  await must(
    supabase.from("project_members").upsert(
      [
        {
          id: IDS.projectMemberAlice,
          project_id: IDS.softwareProject,
          semester_id: IDS.semesterActive,
          roster_member_id: IDS.rosterAlice,
          added_by_user_id: admin.id,
          added_at: iso("2026-08-25T10:00:00+07:00"),
        },
        {
          id: IDS.projectMemberBob,
          project_id: IDS.softwareProject,
          semester_id: IDS.semesterActive,
          roster_member_id: IDS.rosterBob,
          added_by_user_id: admin.id,
          added_at: iso("2026-08-25T10:05:00+07:00"),
        },
        {
          id: IDS.projectMemberCharlie,
          project_id: IDS.hardwareProject,
          semester_id: IDS.semesterActive,
          roster_member_id: IDS.rosterCharlie,
          added_by_user_id: admin.id,
          added_at: iso("2026-08-25T10:10:00+07:00"),
        },
      ],
      { onConflict: "id" },
    ),
    "Seed project_members",
  );

  // ---------------------------------------------------------------------------
  // 6. Private Storage + project_files metadata
  // ---------------------------------------------------------------------------
  await ensurePrivateBucket(supabase);

  const softwareSrsPath = `${IDS.softwareProject}/srs/seed-srs.md`;
  const softwareTemplatePath = `${IDS.softwareProject}/contribution-template/seed-template.csv`;
  const hardwareSrsPath = `${IDS.hardwareProject}/srs/seed-srs.md`;
  const hardwareBomPath = `${IDS.hardwareProject}/bom/seed-bom.csv`;

  const softwareSrsSize = await uploadSeedFile(
    supabase,
    softwareSrsPath,
    "# Seed SRS\n\nMock SRS document for backend API testing.\n",
    "text/markdown",
  );
  const softwareTemplateSize = await uploadSeedFile(
    supabase,
    softwareTemplatePath,
    "member,contribution,percentage\nAlice,Frontend,50\nBob,Backend,50\n",
    "text/csv",
  );
  const hardwareSrsSize = await uploadSeedFile(
    supabase,
    hardwareSrsPath,
    "# Hardware Seed SRS\n\nMock hardware project requirements.\n",
    "text/markdown",
  );
  const hardwareBomSize = await uploadSeedFile(
    supabase,
    hardwareBomPath,
    "item,quantity,unit_cost_vnd\nESP32,2,180000\nRFID Reader,2,95000\n",
    "text/csv",
  );

  await must(
    supabase.from("project_files").upsert(
      [
        {
          id: IDS.fileSoftwareSrs,
          project_id: IDS.softwareProject,
          category: "SRS",
          bucket_id: FILE_BUCKET,
          object_path: softwareSrsPath,
          original_filename: "software-project-srs.md",
          content_type: "text/markdown",
          size_bytes: softwareSrsSize,
          checksum: null,
          uploaded_by_user_id: admin.id,
          retired_at: null,
        },
        {
          id: IDS.fileSoftwareTemplate,
          project_id: IDS.softwareProject,
          category: "CONTRIBUTION_TEMPLATE",
          bucket_id: FILE_BUCKET,
          object_path: softwareTemplatePath,
          original_filename: "contribution-template.csv",
          content_type: "text/csv",
          size_bytes: softwareTemplateSize,
          checksum: null,
          uploaded_by_user_id: admin.id,
          retired_at: null,
        },
        {
          id: IDS.fileHardwareSrs,
          project_id: IDS.hardwareProject,
          category: "SRS",
          bucket_id: FILE_BUCKET,
          object_path: hardwareSrsPath,
          original_filename: "hardware-project-srs.md",
          content_type: "text/markdown",
          size_bytes: hardwareSrsSize,
          checksum: null,
          uploaded_by_user_id: admin.id,
          retired_at: null,
        },
        {
          id: IDS.fileHardwareBom,
          project_id: IDS.hardwareProject,
          category: "BOM",
          bucket_id: FILE_BUCKET,
          object_path: hardwareBomPath,
          original_filename: "hardware-project-bom.csv",
          content_type: "text/csv",
          size_bytes: hardwareBomSize,
          checksum: null,
          uploaded_by_user_id: admin.id,
          retired_at: null,
        },
      ],
      { onConflict: "id" },
    ),
    "Seed project_files",
  );

  // ---------------------------------------------------------------------------
  // 7. Email campaigns
  // ---------------------------------------------------------------------------
  await must(
    supabase.from("email_campaigns").upsert(
      [
        {
          id: IDS.kickoffCampaign,
          semester_id: IDS.semesterActive,
          project_id: IDS.softwareProject,
          kind: "KICKOFF",
          scheduled_at: iso("2026-09-04T09:00:00+07:00"),
          template_key: "project-kickoff",
          template_version: 1,
          status: "COMPLETED_WITH_FAILURES",
          idempotency_key: "seed:kickoff:software-project:v1",
          created_by_user_id: admin.id,
          started_at: iso("2026-09-04T09:00:00+07:00"),
          completed_at: iso("2026-09-04T09:01:00+07:00"),
        },
        {
          id: IDS.demoCampaign,
          semester_id: IDS.semesterActive,
          project_id: null,
          kind: "DEMO",
          scheduled_at: iso("2026-11-18T09:00:00+07:00"),
          template_key: "semester-demo",
          template_version: 1,
          status: "SCHEDULED",
          idempotency_key: "seed:demo:semester-b-2026:v1",
          created_by_user_id: admin.id,
          started_at: null,
          completed_at: null,
        },
      ],
      { onConflict: "id" },
    ),
    "Seed email_campaigns",
  );

  // ---------------------------------------------------------------------------
  // 8. Email deliveries
  // Includes SENT, FAILED_RETRYABLE and PENDING states for API tests.
  // ---------------------------------------------------------------------------
  await must(
    supabase.from("email_deliveries").upsert(
      [
        {
          id: IDS.deliveryKickoffAlice,
          campaign_id: IDS.kickoffCampaign,
          semester_id: IDS.semesterActive,
          roster_member_id: IDS.rosterAlice,
          recipient_email_snapshot: "alice.nguyen@example.com",
          status: "SENT",
          attempt_count: 1,
          last_attempt_at: iso("2026-09-04T09:00:10+07:00"),
          sent_at: iso("2026-09-04T09:00:11+07:00"),
          next_attempt_at: null,
          provider_message_id: "seed-provider-message-alice",
          last_error_code: null,
          last_error_summary: null,
        },
        {
          id: IDS.deliveryKickoffBob,
          campaign_id: IDS.kickoffCampaign,
          semester_id: IDS.semesterActive,
          roster_member_id: IDS.rosterBob,
          recipient_email_snapshot: "bob.tran@example.com",
          status: "FAILED_RETRYABLE",
          attempt_count: 1,
          last_attempt_at: iso("2026-09-04T09:00:15+07:00"),
          sent_at: null,
          next_attempt_at: iso("2026-09-04T09:10:00+07:00"),
          provider_message_id: null,
          last_error_code: "SEED_TIMEOUT",
          last_error_summary: "Mock provider timeout for retry-path testing.",
        },
        {
          id: IDS.deliveryDemoAlice,
          campaign_id: IDS.demoCampaign,
          semester_id: IDS.semesterActive,
          roster_member_id: IDS.rosterAlice,
          recipient_email_snapshot: "alice.nguyen@example.com",
          status: "PENDING",
          attempt_count: 0,
          last_attempt_at: null,
          sent_at: null,
          next_attempt_at: null,
          provider_message_id: null,
          last_error_code: null,
          last_error_summary: null,
        },
        {
          id: IDS.deliveryDemoBob,
          campaign_id: IDS.demoCampaign,
          semester_id: IDS.semesterActive,
          roster_member_id: IDS.rosterBob,
          recipient_email_snapshot: "bob.tran@example.com",
          status: "PENDING",
          attempt_count: 0,
          last_attempt_at: null,
          sent_at: null,
          next_attempt_at: null,
          provider_message_id: null,
          last_error_code: null,
          last_error_summary: null,
        },
        {
          id: IDS.deliveryDemoCharlie,
          campaign_id: IDS.demoCampaign,
          semester_id: IDS.semesterActive,
          roster_member_id: IDS.rosterCharlie,
          recipient_email_snapshot: "charlie.le@example.com",
          status: "PENDING",
          attempt_count: 0,
          last_attempt_at: null,
          sent_at: null,
          next_attempt_at: null,
          provider_message_id: null,
          last_error_code: null,
          last_error_summary: null,
        },
      ],
      { onConflict: "id" },
    ),
    "Seed email_deliveries",
  );

  // ---------------------------------------------------------------------------
  // 9. Audit events
  // ---------------------------------------------------------------------------
  await must(
    supabase.from("audit_events").upsert(
      [
        {
          id: IDS.auditSemester,
          actor_user_id: admin.id,
          action: "SEMESTER_ACTIVATED",
          entity_type: "SEMESTER",
          entity_id: IDS.semesterActive,
          metadata: { source: "seed", name: "Semester B 2026 - Seed" },
          request_id: "seed-request-001",
          occurred_at: iso("2026-08-01T09:00:00+07:00"),
        },
        {
          id: IDS.auditSoftwareProject,
          actor_user_id: admin.id,
          action: "PROJECT_CREATED",
          entity_type: "PROJECT",
          entity_id: IDS.softwareProject,
          metadata: { source: "seed", type: "SOFTWARE" },
          request_id: "seed-request-002",
          occurred_at: iso("2026-08-20T09:00:00+07:00"),
        },
        {
          id: IDS.auditAssignment,
          actor_user_id: admin.id,
          action: "PROJECT_MEMBER_ASSIGNED",
          entity_type: "PROJECT_MEMBER",
          entity_id: IDS.projectMemberAlice,
          metadata: {
            source: "seed",
            project_id: IDS.softwareProject,
            roster_member_id: IDS.rosterAlice,
          },
          request_id: "seed-request-003",
          occurred_at: iso("2026-08-25T10:00:00+07:00"),
        },
        {
          id: IDS.auditCampaign,
          actor_user_id: admin.id,
          action: "EMAIL_CAMPAIGN_SCHEDULED",
          entity_type: "EMAIL_CAMPAIGN",
          entity_id: IDS.demoCampaign,
          metadata: { source: "seed", kind: "DEMO" },
          request_id: "seed-request-004",
          occurred_at: iso("2026-09-01T09:00:00+07:00"),
        },
      ],
      { onConflict: "id" },
    ),
    "Seed audit_events",
  );

  console.log("\nSeed complete.");
  console.log("Test accounts:");
  for (const user of SEED_USERS) {
    console.log(`  ${user.role.padEnd(6)} ${user.email}`);
  }
  console.log(`  Password: ${SEED_PASSWORD}`);
  console.log(`  Active semester ID: ${IDS.semesterActive}`);
  console.log(`  Software project ID: ${IDS.softwareProject}`);
  console.log(`  Hardware project ID: ${IDS.hardwareProject}`);
  console.log(`  Private bucket: ${FILE_BUCKET}`);
}

main().catch((error) => {
  console.error("\nSeed failed:", error);
  process.exit(1);
});
