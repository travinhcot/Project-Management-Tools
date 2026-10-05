import type { ActorLocals } from "../../../shared/request-actor.ts";

export type AccountRole = "ADMIN" | "MEMBER";

/** The profile shape auth needs. Implemented by the users module and wired in server.ts. */
export interface AccountProfile {
  readonly id: string;
  readonly email: string;
  readonly normalized_email: string;
  readonly full_name: string;
  readonly role: AccountRole;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ProfileIdentity {
  readonly id: string;
  readonly email: string;
}

/** Port: auth depends on this interface, never on the users module directly. */
export interface ProfileGateway {
  getActiveProfile(identity: ProfileIdentity): Promise<AccountProfile>;
  updateOwnProfile(identity: ProfileIdentity, fullName: string): Promise<AccountProfile>;
}

/**
 * Port: auth reports security events through this interface, never by importing the audit
 * module. Implementations must not throw into the sign-in flow.
 */
export interface AuthAuditEvent {
  readonly actorId: string | null;
  readonly action:
    | "AUTH_OTP_REQUESTED"
    | "AUTH_SIGN_IN_SUCCEEDED"
    | "AUTH_SIGN_IN_FAILED"
    | "AUTH_SIGNED_OUT";
  readonly entityType: "AUTH";
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly requestId: string;
}

export interface AuditRecorder {
  record(event: AuthAuditEvent): Promise<void>;
}

/** In-memory identity obtained by verifying the caller with Supabase Auth.
 * Never construct this from unverified JWT claims or browser profile input.
 * No raw password, OTP, magic link or session token belongs in this model.
 */
export interface VerifiedAuthIdentity {
  readonly id: string;
  readonly email: string;
  readonly email_verified_at: string;
}

/** Request-local authentication context, not a persisted session table.
 * A context alone does not grant project access: services must check current
 * activation, semester roster eligibility and assignment on each request.
 */
export interface AuthenticatedUser {
  readonly identity: VerifiedAuthIdentity;
  readonly profile: AccountProfile;
}

/** Express response-local state; access token stays request-local. */
export interface AuthLocals extends ActorLocals {
  auth?: AuthenticatedUser;
  accessToken?: string;
}
