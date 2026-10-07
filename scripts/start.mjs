// Production start for a single host (e.g. one Render web service).
// The host routes its public URL to $PORT, so the website takes $PORT and the Express backend
// stays internal on BACKEND_PORT. The frontend reaches it server-side via API_BASE_URL.
import { spawn } from "node:child_process";

const publicPort = process.env.PORT || "5173";
const backendPort = process.env.BACKEND_PORT || "3001";
if (publicPort === backendPort) {
  console.error(`PORT and BACKEND_PORT are both ${publicPort}; set BACKEND_PORT to a different value.`);
  process.exit(1);
}

const children = [
  spawn("bun", ["run", "--cwd", "backend", "start"], {
    stdio: "inherit",
    env: { ...process.env, PORT: backendPort },
  }),
  spawn("bun", ["run", "--cwd", "frontend", "next", "start", "-p", publicPort], {
    stdio: "inherit",
    env: { ...process.env, API_BASE_URL: process.env.API_BASE_URL || `http://localhost:${backendPort}` },
  }),
];

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 3000).unref();
}
for (const child of children) child.on("exit", (code) => stop(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(0));
