// Session cookies for the admin area. Tokens never reach client JavaScript: they live in
// httpOnly cookies that only the proxy, Server Actions and Server Components can read.
export const ACCESS_COOKIE = "nct_access";
export const REFRESH_COOKIE = "nct_refresh";

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

export function writeSession(cookies: CookieWriter, session: BackendSession) {
  // The access cookie expires with the token, which is what tells the proxy to refresh.
  cookies.set(ACCESS_COOKIE, session.access_token, options(Math.max(1, session.expires_in)));
  cookies.set(REFRESH_COOKIE, session.refresh_token, options(REFRESH_MAX_AGE_SECONDS));
}

export function clearSession(cookies: CookieWriter) {
  cookies.delete(ACCESS_COOKIE);
  cookies.delete(REFRESH_COOKIE);
}
