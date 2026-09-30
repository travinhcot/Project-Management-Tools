# Dept Tech Project Management — standalone PostgreSQL schema

This is the **physical schema proposal** for the independent application described in `Dept-Tech-Project-Data-Model.md`. These are application-owned tables in a dedicated Supabase project; none reference NCT Hub. Supabase Auth and private Storage are configured for **this app**, but their internal tables are managed by Supabase. This document is not a SQL migration and does not claim that any table exists yet.

The older `SRS-Project-Management-Web-App-Expanded.md` and `Dept-Tech-Functional-Requirements-SRS.md` still prescribe NCT Hub integration. Their Hub-specific architecture must be updated before implementing this standalone schema. Feature requirements such as semester rosters, software/hardware projects, assignment, passwordless access, files, and scheduled email remain the design inputs.

All IDs are UUIDs. All timestamps are `timestamptz` UTC instants; the UI converts schedules to `Asia/Ho_Chi_Minh`. Each table has `created_at` and `updated_at` where ongoing edits are expected. Names below intentionally omit the old `dept_tech_` prefix because this database belongs only to Dept Tech.

## Tables and constraints

### `app_users` — administrator and member accounts

| Column | Type | Rule |
|---|---|---|
| `id` | `uuid` | PK; FK to **this project's** `auth.users(id)` with restricted deletion |
| `email` | `varchar(320)` | Required verified account email; display value |
| `normalized_email` | `varchar(320)` | Required; unique; lowercased and trimmed on trusted write |
| `full_name` | `varchar(200)` | Required |
| `role` | `text` | Required; `ADMIN` or `MEMBER`; default `MEMBER` |
| `is_active` | `boolean` | Required; default true |
| `created_at`, `updated_at` | `timestamptz` | Required |

There is **one user table**, not separate `admin_users` and `members` account tables. `role` is a controlled authorization attribute; only trusted server or administrative provisioning may set `ADMIN`. Public signup/OTP callbacks cannot self-select or update it. Do not store passwords, OTPs, or session tokens here. If a user has an Auth account but no eligible active roster entry, authentication alone gives no project access. Creating the first admin requires a controlled bootstrap procedure.

### `semesters`

| Column | Type | Rule |
|---|---|---|
| `id` | `uuid` | PK |
| `name` | `varchar(100)` | Required; unique after trim/case normalization as approved |
| `is_active` | `boolean` | Required; default false |
| `demo_registration_url` | `text` | Nullable; HTTPS validation |
| `demo_scheduled_at` | `timestamptz` | Nullable |
| `created_at`, `updated_at` | `timestamptz` | Required |

Use a partial unique index on a constant expression where `is_active = true` to allow **at most one** active semester globally. Activate a new semester and deactivate the old one in one transaction. The schema does not require that a semester always be active.

### `roster_imports`

| Column | Type | Rule |
|---|---|---|
| `id` | `uuid` | PK |
| `semester_id` | `uuid` | Required FK to `semesters(id)` |
| `initiated_by_user_id` | `uuid` | Required FK to `app_users(id)`; admin authorization checked by server |
| `filename`, `file_checksum` | `text` | Required; checksum prevents accidental repeated import |
| `status` | `text` | Required; `VALIDATING`, `COMPLETED`, or `FAILED` |
| `total_rows`, `accepted_rows`, `rejected_rows` | `integer` | Required, nonnegative; accepted + rejected ≤ total |
| `error_summary` | `jsonb` | Nullable; sanitized validation summary, not raw CSV secrets |
| `created_at`, `completed_at` | `timestamptz` | `created_at` required; completion nullable |

### `roster_members`

| Column | Type | Rule |
|---|---|---|
| `id` | `uuid` | PK |
| `semester_id` | `uuid` | Required FK to `semesters(id)` |
| `user_id` | `uuid` | Nullable FK to `app_users(id)`; set after trusted verified-email match |
| `email`, `normalized_email` | `varchar(320)` | Required; normalized email trimmed and lowercased |
| `full_name` | `varchar(200)` | Required |
| `other_info` | `jsonb` | Required; default `{}`; approved extra CSV fields only |
| `is_active` | `boolean` | Required; default true |
| `created_at`, `updated_at` | `timestamptz` | Required |

`UNIQUE (semester_id, normalized_email)` prevents duplicate roster identities. A partial unique index on `(semester_id, user_id) WHERE user_id IS NOT NULL` prevents linking two entries in one semester to one account. Add `UNIQUE (id, semester_id)` for same-semester composite foreign keys. A roster record can exist without a user account; it is not an independent login credential.

### `projects`

| Column | Type | Rule |
|---|---|---|
| `id` | `uuid` | PK |
| `semester_id` | `uuid` | Required FK to `semesters(id)` |
| `name` | `varchar(150)` | Required |
| `type` | `text` | Required; `SOFTWARE` or `HARDWARE` |
| `kickoff_scheduled_at` | `timestamptz` | Nullable |
| `srs_external_url`, `first_meeting_url`, `bom_external_url` | `text` | Nullable; HTTPS validation; BOM URL only for hardware |
| `archived_at` | `timestamptz` | Nullable |
| `created_at`, `updated_at` | `timestamptz` | Required |

Add `UNIQUE (id, semester_id)` for same-semester references. A `CHECK` can require `bom_external_url IS NULL` for software projects. SRS and BOM may have an external URL or active uploaded file; enforce the chosen one-source-per-slot rule in the project/file write transaction. The contribution template is an uploaded file; the first-meeting slot is a URL.

### `project_members`

| Column | Type | Rule |
|---|---|---|
| `id` | `uuid` | PK |
| `project_id`, `semester_id` | `uuid` | Required composite FK to `projects(id, semester_id)` |
| `roster_member_id`, `semester_id` | `uuid` | Required composite FK to `roster_members(id, semester_id)` |
| `added_by_user_id` | `uuid` | Required FK to `app_users(id)` |
| `added_at` | `timestamptz` | Required |

`UNIQUE (project_id, roster_member_id)` prevents duplicate assignments. The shared `semester_id` makes cross-semester assignments impossible at the database level. The server must also reject inactive roster members and require admin role. Delete/revoke assignment rather than deleting account or roster history; record the change in `audit_events`.

### `project_files` — file-handler metadata

| Column | Type | Rule |
|---|---|---|
| `id` | `uuid` | PK |
| `project_id` | `uuid` | Required FK to `projects(id)` |
| `category` | `text` | Required; `SRS`, `CONTRIBUTION_TEMPLATE`, or `BOM` |
| `bucket_id`, `object_path` | `text` | Required private bucket and server-generated path; unique pair |
| `original_filename` | `text` | Required display name, never trusted as a storage path |
| `content_type` | `varchar(255)` | Required; validate against detected content |
| `size_bytes` | `bigint` | Required; greater than zero and within approved limit |
| `checksum` | `text` | Nullable integrity metadata |
| `uploaded_by_user_id` | `uuid` | Required FK to `app_users(id)` |
| `created_at`, `retired_at` | `timestamptz` | Created required; retirement nullable |

Create `UNIQUE (bucket_id, object_path)` and a partial unique index on `(project_id, category) WHERE retired_at IS NULL`. Enforce that `BOM` belongs only to a hardware project through a transaction or trigger, since a simple row `CHECK` cannot read `projects.type`. File bytes live in **this app's private Supabase Storage bucket**, never in this table or the server's local filesystem. Upload handlers validate size, extension, detected MIME type, category, and role; downloads issue short-lived signed URLs only after current project authorization. Storage and database writes are separate operations, so failed uploads/replacements need cleanup of orphaned objects.

### `email_campaigns`

| Column | Type | Rule |
|---|---|---|
| `id` | `uuid` | PK |
| `semester_id` | `uuid` | Required FK to `semesters(id)` |
| `project_id` | `uuid` | Nullable; `(project_id, semester_id)` FK to `projects(id, semester_id)` |
| `kind` | `text` | Required; `KICKOFF` or `DEMO` |
| `scheduled_at` | `timestamptz` | Required |
| `template_key`, `template_version` | `text`, `integer` | Required fixed template identity/version |
| `status` | `text` | Required; `DRAFT`, `SCHEDULED`, `PROCESSING`, `COMPLETED`, `COMPLETED_WITH_FAILURES`, or `CANCELLED` |
| `idempotency_key` | `text` | Required; globally unique in this app |
| `created_by_user_id` | `uuid` | Required FK to `app_users(id)` |
| `created_at`, `started_at`, `completed_at` | `timestamptz` | Created required; others nullable |

`CHECK ((kind = 'KICKOFF' AND project_id IS NOT NULL) OR (kind = 'DEMO' AND project_id IS NULL))`. Add `UNIQUE (id, semester_id)` for delivery integrity. A kickoff campaign targets active assigned roster members; a demo campaign targets active semester roster members. Schedule edits after a completed send do not automatically resend. Provider credentials and full message bodies are not stored here.

### `email_deliveries`

| Column | Type | Rule |
|---|---|---|
| `id` | `uuid` | PK |
| `campaign_id`, `semester_id` | `uuid` | Required composite FK to `email_campaigns(id, semester_id)` |
| `roster_member_id`, `semester_id` | `uuid` | Required composite FK to `roster_members(id, semester_id)` |
| `recipient_email_snapshot` | `varchar(320)` | Required; preserves historical recipient address |
| `status` | `text` | Required; `PENDING`, `SENDING`, `SENT`, `FAILED_RETRYABLE`, or `FAILED_PERMANENT` |
| `attempt_count` | `integer` | Required; nonnegative; default 0 |
| `last_attempt_at`, `sent_at`, `next_attempt_at` | `timestamptz` | Nullable |
| `provider_message_id`, `last_error_code`, `last_error_summary` | `text` | Nullable; sanitized, no credentials |
| `created_at`, `updated_at` | `timestamptz` | Required |

`UNIQUE (campaign_id, roster_member_id)` prevents duplicate recipients in one campaign. A protected worker must atomically claim pending/retryable rows before sending and never routinely resend `SENT` rows. External providers cannot guarantee exactly-once delivery after a timeout, so uncertain attempts need operator-visible handling.

### `audit_events`

| Column | Type | Rule |
|---|---|---|
| `id` | `uuid` | PK |
| `actor_user_id` | `uuid` | Nullable FK to `app_users(id)`; null for system events |
| `action`, `entity_type` | `text` | Required |
| `entity_id` | `uuid` | Nullable for events without one entity |
| `metadata` | `jsonb` | Required; default `{}`; allowlisted non-sensitive details |
| `request_id` | `text` | Nullable correlation identifier |
| `occurred_at` | `timestamptz` | Required |

Keep audit history even after deactivation. Never store login codes, magic links, session tokens, Storage signed URLs, service keys, provider credentials, or sensitive email bodies.

## Indexes and authorization

| Index | Purpose |
|---|---|
| `semesters` unique constant where `is_active` | At most one active semester |
| `roster_members(semester_id, normalized_email)` unique | Import and verified identity matching |
| `roster_members(user_id, semester_id)` | Current member lookup |
| `projects(semester_id, archived_at)` | Admin and member lists |
| `project_members(project_id, roster_member_id)` unique; reverse `(roster_member_id, project_id)` | Assignment integrity and member project list |
| `project_files(project_id, category)` unique where `retired_at IS NULL` | One current upload per slot |
| `email_campaigns(status, scheduled_at)` and unique `idempotency_key` | Due-work scheduling and duplicate prevention |
| `email_deliveries(status, next_attempt_at)` and unique `(campaign_id, roster_member_id)` | Retry work and recipient uniqueness |
| `audit_events(occurred_at)` and `(actor_user_id, occurred_at)` | Admin history |

Enable RLS on **every application table** when exposed through Supabase's Data API. Restrict user-profile and role updates to trusted server/admin paths; a member cannot modify their role, active status, or roster link. Admin reads/writes require active `app_users.role = 'ADMIN'`. Member project/file reads require an active app user, active roster entry in the active semester, and current `project_members` assignment. Deny direct member reads of other members' roster, campaigns, deliveries, and audit records. A server using a Supabase secret/service-role key bypasses RLS and must repeat these checks; never expose that key to the browser. Lock Storage to a private bucket and authorize every signed download server-side.

## Migration and unresolved choices

Create these **10 application tables** in dependency order: `app_users`, `semesters`, `roster_imports`, `roster_members`, `projects`, `project_members`, `project_files`, `email_campaigns`, `email_deliveries`, `audit_events`. Add checks, composite referenced keys, foreign keys, indexes, RLS policies, and private Storage policies in reviewed migrations. Run migrations only against the independent app's Supabase project. No NCT Hub migration or data reuse is implied.

The campaign email provider and verified sender remain open: the original SRS names Microsoft Graph/Outlook, while the Hub-focused expansion names AWS SES. Also confirm CSV columns, allowed email domains, upload size/type limits, retention, historical-semester access, archive behavior, and scheduling defaults before final migrations.
