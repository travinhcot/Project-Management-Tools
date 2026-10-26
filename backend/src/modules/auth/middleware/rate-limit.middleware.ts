import type { Request, RequestHandler } from "express";

import { createHash, timingSafeEqual } from "node:crypto";
import { HttpError } from "../../../shared/http-error.ts";

function sameSecret(given: string | undefined, expected: string): boolean {
  if (given === undefined) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The frontend server makes every auth call, so req.ip is the same for all visitors. It sends the
 * visitor's IP in x-client-ip, trusted only alongside the shared x-auth-proxy-secret.
 */
function clientKey(req: Request, clientIpSecret: string | undefined): string {
  const forwarded = req.get("x-client-ip")?.trim();
  if (
    clientIpSecret &&
    forwarded &&
    forwarded.length <= 64 &&
    sameSecret(req.get("x-auth-proxy-secret"), clientIpSecret)
  ) {
    return `client:${forwarded}`;
  }
  return req.ip || "unknown";
}

/** Bounded process-local limiter; Supabase also enforces provider-side limits. */
export function createAuthRateLimit({
  limit = 20,
  windowMs = 60_000,
  maxKeys = 10_000,
  clientIpSecret,
}: { limit?: number; windowMs?: number; maxKeys?: number; clientIpSecret?: string } = {}): RequestHandler {
  const entries = new Map<string, { count: number; until: number }>();
  return (req, res, next) => {
    const now = Date.now();
    // Expire entries on request so there is no background timer or retained secrets.
    for (const [key, entry] of entries) if (entry.until <= now) entries.delete(key);
    const key = createHash("sha256").update(clientKey(req, clientIpSecret)).digest("hex");
    let entry = entries.get(key);
    if (!entry) {
      if (entries.size >= maxKeys) {
        return next(new HttpError(429, "AUTH_RATE_LIMITED", "Please try again shortly."));
      }
      entry = { count: 0, until: now + windowMs };
      entries.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > limit) {
      res.set("Retry-After", String(Math.ceil((entry.until - now) / 1000)));
      return next(new HttpError(429, "AUTH_RATE_LIMITED", "Too many authentication requests."));
    }
    next();
  };
}
