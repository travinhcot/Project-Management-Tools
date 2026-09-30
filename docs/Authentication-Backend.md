# Authentication backend: simple and medium

Implements FR-AUTH-001–004 using Supabase email OTP authentication, user profiles,
ADMIN/MEMBER roles, session refresh/expiration, and protected API middleware.
MFA, OAuth and login activity tracking are outside scope.

## Setup

Use Node.ts 24+. From `backend/`, run `npm run dev` or `npm start`.
Copy the settings in `backend/.env.example` into the repository-root `.env.local`.
The backend requires `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and
`SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`). The secret key is
server-only; never put it in frontend configuration. `ALLOWED_ORIGINS` accepts
comma-separated frontend origins and defaults to `http://localhost:5173`.

Apply `backend/src/config/supabase/migration/app-user.schema.sql` once to this
app's dedicated Supabase project. It requires Supabase Auth tables and roles.
The backend does not run migrations or modify remote settings automatically.

Enable email authentication in Supabase and configure the Magic Link email
template to display `{{ .Token }}` for code entry. Configure SMTP, OTP expiry,
JWT expiry and provider rate limits there. This backend accepts 6–10 digit OTPs
and uses provider session expiry. It never persists credentials or session tokens.

Create and verify an Auth account through Supabase, then provision its app profile
with this trusted command from `backend/`:

```text
npm run provision:user -- <auth-user-uuid> "Full Name" MEMBER
npm run provision:user -- <first-admin-auth-user-uuid> "Admin Name" ADMIN
```

Provisioning inserts through the users module interface without overwriting an
existing profile. ADMIN provisioning requires trusted shell access. Public OTP
requests cannot create accounts or choose roles. An unprovisioned/inactive app
profile cannot access protected endpoints even with valid Supabase credentials.

## Endpoints

All paths start with `/api/auth`.

| Method | Path | Body / authentication | Result |
| --- | --- | --- | --- |
| POST | `/otp` | `{ "email": "member@example.com" }` | 202 generic acknowledgement |
| POST | `/verify` | `{ "email": "member@example.com", "token": "123456" }` | user and session |
| POST | `/refresh` | `{ "refresh_token": "..." }` | user and renewed session |
| POST | `/logout` | Bearer access token | 204; revoke current refresh session |
| GET | `/me` | Bearer access token | `{ "user": { ... } }` |
| PATCH | `/me` | Bearer token, `{ "full_name": "Updated Name" }` | updated user |

Use `Authorization: Bearer <access_token>`. Verify/refresh return
`{ user, session: { access_token, refresh_token, token_type, expires_at, expires_in } }`.
`expires_at` is Unix seconds. Clients replace both tokens after refresh, avoid
concurrent refreshes, and discard tokens on logout. Tokens are explicitly passed;
the backend does not use auth cookies. Responses have `Cache-Control: no-store`.
Never log authorization headers, OTP bodies or session responses.

Errors return `{ error: { code, message } }`: 400 invalid input, 401 invalid/expired
credentials, 403 account/role restriction, 429 rate limit, and 503 provider/profile
unavailability. Unexpected errors are sanitized.

## Ownership and protection

Auth owns provider integration and middleware; users owns `app_users`, profile
queries and trusted provisioning. Auth communicates with users through its public
interface. The auth interface returns `router`, `requireAuth` and `requireRole`.
Other modules protect routes in this order:

```js
router.post("/admin-action", auth.requireAuth, auth.requireRole("ADMIN"), controller);
```

Every protected request verifies the access token with Supabase `getUser` and
reads the current active profile. Database role/active state are authoritative;
Auth user metadata and public request fields cannot grant ADMIN. Profile updates
accept only `full_name`. RLS denies browser profile writes and allows only the
caller's own active-profile read. The backend secret bypasses RLS, so service
authorization remains mandatory.

Member project/file access additionally requires current active-semester roster
eligibility and assignment checks in those modules. This auth feature grants
identity/profile access only and does not implement roster or project workflows.

Supabase logout revokes refresh tokens; an issued access JWT can remain valid
until its expiry. Configure a suitably short JWT lifetime. No duplicate app
session-token table is introduced. The request limiter is process-local; provider
limits cover deployments with multiple servers. Proxy trust is disabled; configure
it for your actual proxy before relying on forwarded client IPs.

## Verification

`npm test` exercises real Express routes and module wiring with mocked Supabase
and database responses. It does not verify live SMTP, Supabase sessions or applied
PostgreSQL RLS. Run live OTP, refresh, logout and role checks after configuration.
