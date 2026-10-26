/** Server-only: the Express backend. Never exposed to the browser (no NEXT_PUBLIC_ prefix). */
export const API_BASE_URL =
  process.env.API_BASE_URL ??
  "https://project-management-tools-70gp.onrender.com";

/**
 * Auth calls reach the backend from this server, so the backend would see one IP for everyone.
 * These headers hand it the visitor's IP for its rate limit; it trusts them only with the secret.
 */
export function authProxyHeaders(forwardedFor: string | null): Record<string, string> {
  const secret = process.env.AUTH_PROXY_SECRET;
  // shortcut: the last X-Forwarded-For entry assumes one trusted proxy hop (Render's edge); revisit if a CDN is added in front.
  const clientIp = forwardedFor?.split(",").map((part) => part.trim()).filter(Boolean).at(-1);
  if (!secret || !clientIp) return {};
  return { "x-auth-proxy-secret": secret, "x-client-ip": clientIp };
}
