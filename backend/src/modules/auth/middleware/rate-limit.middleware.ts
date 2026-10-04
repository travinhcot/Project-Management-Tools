import type { RequestHandler } from "express";

import { createHash } from "node:crypto";
import { HttpError } from "../../../shared/http-error.ts";

/** Bounded process-local limiter; Supabase also enforces provider-side limits. */
export function createAuthRateLimit({ limit = 20, windowMs = 60_000, maxKeys = 10_000 } = {}): RequestHandler {
  const entries = new Map<string, { count: number; until: number }>();
  return (req, res, next) => {
    const now = Date.now();
    // Expire entries on request so there is no background timer or retained secrets.
    for (const [key, entry] of entries) if (entry.until <= now) entries.delete(key);
    const key = createHash("sha256").update(req.ip || "unknown").digest("hex");
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
