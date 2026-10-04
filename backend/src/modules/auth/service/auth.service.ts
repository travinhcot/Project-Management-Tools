import type { AuthRepository, ProviderSessionData, ProviderUser } from "../repository/auth.repository.ts";
import type { UsersService, ProfileIdentity } from "../../users/interface/user.interface.ts";
import type { AuthenticatedUser, VerifiedAuthIdentity } from "../model/auth.model.ts";

import { HttpError } from "../../../shared/http-error.ts";

export function createAuthService(repository: AuthRepository, users: UsersService) {
  function verifiedIdentity(user: ProviderUser | null): VerifiedAuthIdentity {
    if (!user?.id || !user.email || !user.email_confirmed_at) {
      throw new HttpError(
        401,
        "UNVERIFIED_IDENTITY",
        "A verified email identity is required.",
      );
    }
    return {
      id: user.id,
      email: user.email,
      email_verified_at: user.email_confirmed_at,
    };
  }

  async function authenticate(accessToken: string): Promise<AuthenticatedUser> {
    const identity = verifiedIdentity(await repository.getUser(accessToken));
    const profile = await users.getActiveProfile(identity);
    return { identity, profile };
  }

  async function completeSession(data: ProviderSessionData) {
    if (
      !data?.session?.access_token ||
      !data.session.refresh_token ||
      typeof data.session.expires_at !== "number" || !Number.isFinite(data.session.expires_at) ||
      data.session.expires_at <= Math.floor(Date.now() / 1000)
    ) {
      throw new HttpError(
        401,
        "INVALID_SESSION",
        "No valid session was returned.",
      );
    }
    let context: AuthenticatedUser;
    try {
      context = await authenticate(data.session.access_token);
    } catch (error) {
      // Revoke the new session only when the account is genuinely not allowed in
      // (401/403). Transient failures (e.g. 503 profile unavailable) must not log the user out.
      if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
        try {
          await repository.logout(data.session.access_token);
        } catch {}
      }
      throw error;
    }
    return {
      user: context.profile,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        token_type: "bearer",
        expires_at: data.session.expires_at,
        expires_in: Math.max(
          0,
          data.session.expires_at - Math.floor(Date.now() / 1000),
        ),
      },
    };
  }

  return {
    authenticate,
    requestOtp: (email: string) => repository.requestOtp(email),
    async verifyOtp(email: string, token: string) {
      return completeSession(await repository.verifyOtp(email, token));
    },
    async refresh(refreshToken: string) {
      return completeSession(await repository.refresh(refreshToken));
    },
    logout: (accessToken: string) => repository.logout(accessToken),
    updateProfile: (identity: ProfileIdentity, fullName: string) =>
      users.updateOwnProfile(identity, fullName),
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
