import { NextResponse, type NextRequest } from "next/server";
import { API_BASE_URL } from "@/shared/api/config";
import {
  isMemberPath,
  landingFor,
  resolveLanding,
  safeNextPath,
} from "@/shared/auth/redirect";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ROLE_COOKIE,
  clearSession,
  parseRole,
  roleCookieOptions,
  writeSession,
  type AccountRole,
  type BackendSession,
} from "@/shared/auth/session";

const SIGN_IN_PATH = "/sign-in";

async function refreshSession(
  refreshToken: string,
): Promise<BackendSession | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { session?: BackendSession };
    return body.session ?? null;
  } catch {
    return null;
  }
}

type LiveRole =
  | { status: "ok"; role: AccountRole }
  | { status: "rejected" }
  | { status: "unknown" };

/** The role stored in the database right now, so a manual change there applies on reload. */
async function fetchLiveRole(accessToken: string): Promise<LiveRole> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) return { status: "rejected" };
    if (!response.ok) return { status: "unknown" };
    const body = (await response.json()) as { user?: { role?: string } };
    const role = parseRole(body.user?.role);
    return role ? { status: "ok", role } : { status: "unknown" };
  } catch {
    return { status: "unknown" };
  }
}

/**
 * Optimistic session check on every page request. The access cookie expires with the access
 * token, so when only the refresh cookie is left we renew here: Server Components cannot set
 * cookies, a proxy can. Real authorization still happens in the backend on every call.
 */
export async function proxy(request: NextRequest) {
  const onSignIn = request.nextUrl.pathname === SIGN_IN_PATH;
  // A rejected token sends the visitor to /sign-in?expired=1; don't bounce them back out.
  const staleSession = request.nextUrl.searchParams.has("expired");
  // Sessions from before roles were stored belong to admins (members could not sign in).
  let currentRole: AccountRole =
    parseRole(request.cookies.get(ROLE_COOKIE)?.value) ?? "ADMIN";
  const role = () => currentRole;
  const toLanding = () =>
    NextResponse.redirect(
      new URL(
        resolveLanding(role(), request.nextUrl.searchParams.get("next")),
        request.url,
      ),
    );
  // Members live under /member, admins everywhere else; send each back to their own area.
  const wrongArea = () =>
    !onSignIn &&
    isMemberPath(request.nextUrl.pathname) !== (role() === "MEMBER");
  const toOwnArea = () =>
    NextResponse.redirect(new URL(landingFor(role()), request.url));
  const proceed = (init?: Parameters<typeof NextResponse.next>[0]) =>
    wrongArea() ? toOwnArea() : NextResponse.next(init);
  const toSignIn = () => {
    if (onSignIn) return NextResponse.next();
    // Remember where they were headed so sign-in can continue there.
    const url = new URL(SIGN_IN_PATH, request.url);
    const wanted = request.nextUrl.pathname + request.nextUrl.search;
    if (wanted !== "/" && safeNextPath(wanted) === wanted)
      url.searchParams.set("next", wanted);
    return NextResponse.redirect(url);
  };

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (accessToken) {
    const live = await fetchLiveRole(accessToken);
    if (live.status !== "rejected") {
      const changed = live.status === "ok" && live.role !== currentRole;
      if (live.status === "ok") currentRole = live.role;
      const response = onSignIn && !staleSession ? toLanding() : proceed();
      if (changed) response.cookies.set(ROLE_COOKIE, currentRole, roleCookieOptions);
      return response;
    }
    // Token rejected (revoked or account deactivated): fall through to refresh / sign-in.
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return toSignIn();

  const session = await refreshSession(refreshToken);
  if (session) {
    const live = await fetchLiveRole(session.access_token);
    if (live.status === "ok") currentRole = live.role;
  }
  if (!session) {
    const response = toSignIn();
    clearSession(response.cookies);
    return response;
  }

  // Make the new tokens visible to this same request, then persist them on the response.
  request.cookies.set(ACCESS_COOKIE, session.access_token);
  request.cookies.set(REFRESH_COOKIE, session.refresh_token);
  const response =
    onSignIn && !staleSession ? toLanding() : proceed({ request });
  writeSession(response.cookies, session, currentRole);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
