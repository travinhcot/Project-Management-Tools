// Keeps a Render free-plan web service awake. Render stops a free service after ~15 minutes
// without inbound traffic, so this pings the service's own PUBLIC url every minute. It must be
// the public url (not localhost), because only requests that come in through Render's router count.
//
// Render sets RENDER_EXTERNAL_URL automatically. KEEP_ALIVE_URL overrides it (or enables the ping
// elsewhere); KEEP_ALIVE=off disables it. Nothing is pinged when neither url is set (local dev).
//
// Limit: this only keeps a running service awake. It cannot wake one that is already stopped, so
// for that, also point an external monitor (e.g. UptimeRobot) at <url>/api/health.

const INTERVAL_MS = 60_000;
const TIMEOUT_MS = 10_000;

export function startKeepAlive(): void {
  if (process.env.KEEP_ALIVE === "off") return;
  const base = (process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/+$/, "");
  if (!base) return;
  const url = `${base}/api/health`;

  const ping = async () => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) console.warn(`Keep-alive ping returned ${response.status}.`);
    } catch (error) {
      console.warn("Keep-alive ping failed:", error instanceof Error ? error.message : error);
    }
  };

  setInterval(() => void ping(), INTERVAL_MS).unref();
  console.log(`Keep-alive pinging ${url} every ${INTERVAL_MS / 1000}s.`);
}
