import type { AccountRole } from "./roles.ts";

import { HttpError } from "./http-error.ts";

/** Request-scoped caller, written by the auth middleware. Any module may read it. */
export interface RequestActor {
  readonly userId: string;
  readonly role: AccountRole;
  /** Department a DEPT_ADMIN is bound to; null for ADMIN (every department) and MEMBER. */
  readonly departmentId: string | null;
}

/** Express res.locals shape for routes that run after requireAuth. */
export interface ActorLocals {
  actor?: RequestActor;
}

export function requireActor(locals: ActorLocals): RequestActor {
  if (!locals.actor) throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required.");
  return locals.actor;
}
