import type { SupabaseClient, AuthError, User } from "@supabase/supabase-js";

export interface ProviderSession { readonly access_token: string; readonly refresh_token: string; readonly expires_at?: number; }
export interface ProviderSessionData { readonly session: ProviderSession | null; }
export type ProviderUser = Pick<User, "id" | "email" | "email_confirmed_at">;

import { HttpError } from "../../../shared/http-error.ts";

function providerError(error: Pick<AuthError, "status"> | null, fallback = "Authentication failed.") {
  if (error?.status === 429) return new HttpError(429, "AUTH_RATE_LIMITED", "Please wait before trying again.");
  if (!error?.status || error.status >= 500) return new HttpError(503, "AUTH_UNAVAILABLE", "Authentication is temporarily unavailable.");
  return new HttpError(401, "INVALID_CREDENTIALS", fallback);
}

/** Each operation gets its own client: no shared per-user session state. */
export function createAuthRepository(createClient: () => SupabaseClient, adminClient: SupabaseClient) {
  return {
    async requestOtp(email: string) {
      const { error } = await createClient().auth.signInWithOtp({
        email, options: { shouldCreateUser: false },
      });
      // Keep account existence private. Other provider failures remain actionable.
      if (error && (error.status === 429 || !error.status || error.status >= 500)) {
        throw providerError(error);
      }
    },
    async verifyOtp(email: string, token: string): Promise<ProviderSessionData> {
      const { data, error } = await createClient().auth.verifyOtp({ email, token, type: "email" });
      if (error) throw providerError(error, "The code is invalid or expired.");
      return data;
    },
    async refresh(refreshToken: string): Promise<ProviderSessionData> {
      const { data, error } = await createClient().auth.refreshSession({ refresh_token: refreshToken });
      if (error) throw providerError(error, "The session has expired. Sign in again.");
      return data;
    },
    async getUser(accessToken: string): Promise<ProviderUser | null> {
      const { data, error } = await createClient().auth.getUser(accessToken);
      if (error) throw providerError(error, "The session is invalid or expired.");
      return data.user;
    },
    async logout(accessToken: string) {
      const { error } = await adminClient.auth.admin.signOut(accessToken, "local");
      if (error) throw providerError(error);
    },
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;
