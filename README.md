# Project Management Tools

An internal web app for managing a student technology club's project program. The Executive Board (EB) uses it to run semesters, projects, members and meeting emails; members use a separate read-only portal to see their own projects, resources and upcoming meetings.

## What it does

**Admin workspace (EB)**

- **Overview** — dashboard of stats and projects needing attention.
- **Projects** — create, edit, archive and track project status; assign a leader and members; attach resources (SRS, first-meeting link, BOM for hardware projects) as links or private file uploads; view GitHub activity for a project's repo.
- **Members** — per-semester roster, add/delete members, bulk import from a spreadsheet with a review step.
- **Meeting emails** — kickoff, project-resources and demo email campaigns; schedule or send now; per-recipient delivery status.
- **Semesters** — semester setup and the kickoff meeting link.
- **Users & access** — manage who can sign in and their role.
- **Audit log** — searchable record of actions, with CSV export and retention.

**Member portal** (`/member/*`)

- Overview with upcoming meetings, "My projects" with resources (signed, short-lived file downloads), and a profile page.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Backend | Node.js (runs TypeScript natively), Express 5, TypeScript |
| Database, auth, storage | Supabase (Postgres, email OTP auth, private Storage bucket) via `@supabase/supabase-js` |
| Email | Resend (falls back to console logging when no API key is set) |
| Tooling | Bun workspaces (install and scripts), ESLint, `node --test` |
| Hosting | Single [Render](https://render.com) web service (`scripts/start.mjs` runs both servers) |

## Project layout

```text
Project-Management-Tools/
├── backend/
│   ├── src/
│   │   ├── app.ts, server.ts       # Express app and entry point
│   │   ├── config/                 # Supabase client + SQL migrations (config/supabase/migration)
│   │   ├── modules/                # audit, auth, dashboard, emails, files, github,
│   │   │                           # members, portal, projects, roster, semesters, users
│   │   ├── shared/                 # errors, pagination, query helpers
│   │   └── scripts/                # seed, provision-user, provision-roster, boundary check
│   └── test/
├── frontend/
│   └── src/
│       ├── app/                    # routes: (auth)/sign-in, (app)/* admin, member/*
│       ├── features/               # per-feature components, services, server actions
│       ├── shared/, config/
│       └── proxy.ts                # session refresh and role-based redirects
├── scripts/start.mjs               # production launcher
└── .env.example
```

## Prerequisites

- Node.js 22.6 or newer (the backend runs `.ts` files directly; the latest LTS is recommended)
- Bun 1.3.14
- A Supabase project (use a dev/test project, never production, for local work)
- Optional: a Resend API key for real email delivery, a GitHub token for GitHub activity

## Install

```bash
git clone https://github.com/travinhcot/Project-Management-Tools.git
cd Project-Management-Tools
bun install
```

Install from the repository root so the shared `bun.lock` is used.

## Configure

1. **Database.** Run the SQL files in `backend/src/config/supabase/migration/` against your Supabase project (SQL editor or CLI). Start with `app-user`, `projects`, `semesters-roster` and `platform-tables`, then the rest.
2. **Backend env.** Create `.env.local` at the **repository root** (the backend loads it from there). Use `.env.example` as the base:

   | Variable | Purpose |
   | --- | --- |
   | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Supabase connection (the secret key is server-only) |
   | `ALLOWED_EMAIL_DOMAINS` | Comma-separated domains allowed to sign in; empty accepts any |
   | `APP_URL` | Public frontend URL, used for links in emails |
   | `INTERNAL_SECRET` | Shared secret for `/api/internal/*` (sent as `x-internal-secret`) |
   | `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_BATCH_SIZE` | Email delivery; with no API key, emails are logged to the console |
   | `GITHUB_TOKEN`, `GITHUB_STALE_MINUTES` | Optional GitHub activity (read-only fine-grained token) |
   | `AUDIT_RETENTION_DAYS`, `EMAIL_SCHEDULER`, `TRUST_PROXY`, `KEEP_ALIVE*` | Operational settings; see `backend/.env.example` for details |

3. **Frontend env.** Copy `frontend/.env.example` to `frontend/.env.local` and set `API_BASE_URL` (default `http://localhost:3001`), `ALLOWED_EMAIL_DOMAINS` and optionally `EBMB_CONTACT_EMAIL`.

Never commit real secrets; `.env.local` files are git-ignored.

## Run locally

```bash
bun run dev
```

This starts the backend and frontend together:

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:3001> (health check at `/api/health`)

Run them separately with `bun run dev:backend` and `bun run dev:frontend`.

### Create your first admin

Sign-in is by email one-time code, and there is no public registration. Accounts must be provisioned by a trusted operator:

```bash
# 1. Create/verify the user in Supabase Auth, copy their UUID, then:
cd backend
bun run provision:user <auth-user-uuid> "Full Name" ADMIN
```

For bulk member accounts use `bun run provision:roster`. To fill a **dev-only** database with sample data: `ALLOW_SEED=true bun run seed`.

## Access and roles

| Role | Access |
| --- | --- |
| `ADMIN` | The admin workspace (`/overview`, `/projects`, `/members`, `/meeting-emails`, `/semesters`, `/users-access`, `/audit-log`) and the `/api/admin/*` API |
| `MEMBER` | The member portal (`/member/*`) and `/api/me/*`: only their own projects, resources and profile |
| Internal / scheduler | `/api/internal/*` (email processing, file cleanup, audit retention, GitHub refresh), authenticated with the `INTERNAL_SECRET` header, not a user session |

How access is enforced:

- Sign-in uses a Supabase email OTP, restricted to `ALLOWED_EMAIL_DOMAINS`, with rate limiting.
- Each account has a role and an active flag; deactivated accounts are rejected on every request.
- The frontend `proxy.ts` refreshes sessions and redirects each role to its own area.
- Uploaded files live in a private bucket; downloads are authorized server-side and use signed URLs that expire within 5 minutes.
- Sensitive actions are written to the audit log.

## Scripts

From the repository root:

| Command | Description |
| --- | --- |
| `bun run dev` | Backend and frontend in watch/dev mode |
| `bun run build` | Build the frontend |
| `bun run start` | Production launcher for both servers |

From `backend/`:

| Command | Description |
| --- | --- |
| `bun run test` | Run backend tests |
| `bun run typecheck` | TypeScript check |
| `bun run check:boundaries` | Verify modules don't import across boundaries |
| `bun run seed` / `provision:user` / `provision:roster` | Data scripts (see above) |

From `frontend/`: `bun run lint`, `bun run build`.

## Deployment

`bun run start` runs both servers for a single host such as one Render web service: the site listens on `$PORT`, the Express API stays internal on `BACKEND_PORT` (default 3001), and the frontend reaches it through `API_BASE_URL`. Set the same environment variables on the host. On Render's free plan the backend pings its own `/api/health` to avoid idling (`KEEP_ALIVE`).
