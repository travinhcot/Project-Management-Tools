import type { AppUser } from '../../users/interface/user.interface.ts';

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
  readonly profile: AppUser;
}

/** Express response-local state; access token stays request-local. */
export interface AuthLocals {
  auth?: AuthenticatedUser;
  accessToken?: string;
}
