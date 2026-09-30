# Project Management Tools

This repository is an early project scaffold with two Bun workspaces:

- `backend/` — a Node.js and Express API written in JavaScript.
- `frontend/` — a Next.js App Router application written in TypeScript, with React and Tailwind CSS.

Bun installs dependencies and runs package scripts. Node.js runs the backend. The frontend currently shows the default Next.js starter page; the backend currently exposes only a health endpoint. Authentication, a database, and project-management features have not been implemented yet.

## Requirements

- Node.js 22 or newer
- Bun 1.3.14 (the version declared by `frontend/package.json`)

Check your installation in PowerShell:

```powershell
node --version
bun --version
```

## Install

From the repository root:

```powershell
cd '\Project-Management-Tools'
bun install
```

The root `package.json` lists `backend` and `frontend` as workspaces. Install from the root so dependencies use the root `bun.lock`. Commit that lockfile; `node_modules` and local environment files are ignored by Git.

## Run locally

Open two PowerShell terminals from the repository root.

**Terminal 1 — backend:**

```powershell
node --watch backend/src/app.js
```

The API listens on `http://localhost:3001`. Check it at `http://localhost:3001/api/health`; the response is `{"status":"ok"}`.

**Terminal 2 — frontend:**

```powershell
cd frontend
bun run dev
```

Open `http://localhost:3000`. Stop either server with `Ctrl+C`.

The backend's current `dev` and `start` package scripts refer to `src/server.js`, which does not exist. Use the direct `node` command above until those scripts are corrected. The frontend is not yet connected to the API.

## Project layout

```text
Project-Management-Tools/
├── backend/
│   ├── package.json
│   └── src/app.js             # Express server and /api/health
├── frontend/
│   ├── app/                   # Next.js pages and layout
│   └── package.json
├── package.json               # Bun workspaces
├── bun.lock                   # Root dependency lockfile
└── .gitignore
```

## Useful commands

Run these from `frontend/`:

```powershell
bun run lint
bun run build
```

Add dependencies from the relevant workspace directory with `bun add <package>` and commit the resulting `package.json` and root `bun.lock` changes.
