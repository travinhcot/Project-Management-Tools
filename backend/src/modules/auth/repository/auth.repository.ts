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

/**
 * Local testing only: DEV_AUTH_BYPASS=true stops requestOtp from sending email and lets
 * DEV_AUTH_CODE sign in the emails listed in DEV_AUTH_EMAILS. The session is still a real Supabase
 * one (admin-generated token hash, no email sent). Refuses to run when NODE_ENV=production.
 */
function devBypassConfig() {
  if (process.env.DEV_AUTH_BYPASS !== "true") return null;
  if (process.env.NODE_ENV === "production") {
    throw new Error("DEV_AUTH_BYPASS must not be enabled when NODE_ENV=production");
  }
  const code = process.env.DEV_AUTH_CODE?.trim() ?? "";
  const emails = (process.env.DEV_AUTH_EMAILS ?? "")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (code.length < 6 || emails.length === 0) {
    throw new Error("DEV_AUTH_BYPASS needs DEV_AUTH_CODE (6+ chars) and DEV_AUTH_EMAILS");
  }
  return { code, emails };
}

/** Each operation gets its own client: no shared per-user session state. */
export function createAuthRepository(createClient: () => SupabaseClient, adminClient: SupabaseClient) {
  const devBypass = devBypassConfig();
  if (devBypass) console.warn("[auth] DEV_AUTH_BYPASS is ON: no OTP emails are sent");
  return {
    async requestOtp(email: string) {
      if (devBypass) return;
      const { error } = await createClient().auth.signInWithOtp({
        email, options: { shouldCreateUser: false },
      });
      // Keep account existence private. Other provider failures remain actionable.
      if (error && (error.status === 429 || !error.status || error.status >= 500)) {
        throw providerError(error);
      }
    },
    async verifyOtp(email: string, token: string): Promise<ProviderSessionData> {
      if (devBypass) {
        const normalized = email.trim().toLowerCase();
        if (token !== devBypass.code || !devBypass.emails.includes(normalized)) {
          throw providerError({ status: 400 }, "The code is invalid or expired.");
        }
        const link = await adminClient.auth.admin.generateLink({ type: "magiclink", email: normalized });
        const tokenHash = link.data?.properties?.hashed_token;
        if (link.error || !tokenHash) throw providerError(link.error, "The code is invalid or expired.");
        const { data, error } = await createClient().auth.verifyOtp({ token_hash: tokenHash, type: "email" });
        if (error) throw providerError(error, "The code is invalid or expired.");
        return data;
      }
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
