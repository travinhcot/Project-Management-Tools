import type { RequestHandler } from "express";
import type { AuthService } from "../service/auth.service.ts";
import type { AuthLocals, AccountRole } from "../model/auth.model.ts";

import { HttpError } from "../../../shared/http-error.ts";

export function createAuthMiddleware(service: AuthService) {
  const requireAuth: RequestHandler<Record<string, string>, unknown, unknown, Record<string, string>, AuthLocals> = async (req, res, next) => {
    try {
      const header = req.get("authorization");
      const match = typeof header === "string" && header.length <= 8192
        ? /^Bearer ([^\s]+)$/i.exec(header) : null;
      if (!match) throw new HttpError(401, "AUTH_REQUIRED", "A Bearer access token is required.");
      const context = await service.authenticate(match[1]);
      res.locals.auth = context;
      // Shared request contract (shared/request-actor.ts) read by other modules' routes.
      res.locals.actor = { userId: context.profile.id, role: context.profile.role };
      res.locals.accessToken = match[1];
      next();
    } catch (error) { next(error); }
  };

  function requireRole(...roles: AccountRole[]): typeof requireAuth {
    if (!roles.length || roles.some((role) => !["ADMIN", "MEMBER"].includes(role))) {
      throw new TypeError("requireRole expects ADMIN or MEMBER.");
    }
    return (_req, res, next) => {
      const profile = res.locals.auth?.profile;
      if (!profile) return next(new HttpError(401, "AUTH_REQUIRED", "Authentication is required."));
      if (!profile.is_active || !roles.includes(profile.role)) {
        return next(new HttpError(403, "FORBIDDEN", "You do not have permission for this action."));
      }
      next();
    };
  }
  return { requireAuth, requireRole };
}

export type AuthMiddleware = ReturnType<typeof createAuthMiddleware>;
