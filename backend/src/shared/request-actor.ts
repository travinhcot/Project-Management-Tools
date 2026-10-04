import { HttpError } from "./http-error.ts";

/** Request-scoped caller, written by the auth middleware. Any module may read it. */
export interface RequestActor {
  readonly userId: string;
  readonly role: "ADMIN" | "MEMBER";
}

/** Express res.locals shape for routes that run after requireAuth. */
export interface ActorLocals {
  actor?: RequestActor;
}

export function requireActor(locals: ActorLocals): RequestActor {
  if (!locals.actor) throw new HttpError(401, "AUTH_REQUIRED", "Authentication is required.");
  return locals.actor;
}
