// Session cookies for the admin area. Tokens never reach client JavaScript: they live in
// httpOnly cookies that only the proxy, Server Actions and Server Components can read.
export const ACCESS_COOKIE = "nct_access";
export const REFRESH_COOKIE = "nct_refresh";
/** Which area to show (admin or member). Only a routing hint: the backend enforces roles. */
export const ROLE_COOKIE = "nct_role";

/**
 * ADMIN = EB super-admin (every department); DEPT_ADMIN = admin of one department;
 * MEMBER = a member (the member portal). Everyone but ADMIN has a department on their account.
 * Mirrors ACCOUNT_ROLES in backend/src/shared/roles.ts.
 */
export const MEMBER_ROLES = ["MEMBER"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];
export const ACCOUNT_ROLES = ["ADMIN", "DEPT_ADMIN", ...MEMBER_ROLES] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];
export type AdminRole = Exclude<AccountRole, MemberRole>;

export function isMemberRole(role: AccountRole): role is MemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(role);
}

export function parseRole(value: string | undefined): AccountRole | null {
  return (ACCOUNT_ROLES as readonly (string | undefined)[]).includes(value)
    ? (value as AccountRole)
    : null;
}

/** Supabase refresh tokens last far longer than access tokens; this only bounds the cookie. */
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** The `session` object returned by POST /api/auth/verify and /api/auth/refresh. */
export interface BackendSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface CookieWriter {
  set(name: string, value: string, options: CookieOptions): unknown;
  delete(name: string): unknown;
}

interface CookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
}

const options = (maxAge: number): CookieOptions => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

export const roleCookieOptions = options(REFRESH_MAX_AGE_SECONDS);

export function writeSession(
  cookies: CookieWriter,
  session: BackendSession,
  role?: AccountRole,
) {
  // The access cookie expires with the token, which is what tells the proxy to refresh.
  cookies.set(ACCESS_COOKIE, session.access_token, options(Math.max(1, session.expires_in)));
  cookies.set(REFRESH_COOKIE, session.refresh_token, options(REFRESH_MAX_AGE_SECONDS));
  // A token refresh passes no role and keeps the one chosen at sign-in.
  if (role) cookies.set(ROLE_COOKIE, role, options(REFRESH_MAX_AGE_SECONDS));
}

export function clearSession(cookies: CookieWriter) {
  cookies.delete(ACCESS_COOKIE);
  cookies.delete(REFRESH_COOKIE);
  cookies.delete(ROLE_COOKIE);
}
