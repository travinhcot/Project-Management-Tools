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
  writeSession,
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
  const role = () =>
    parseRole(request.cookies.get(ROLE_COOKIE)?.value) ?? "ADMIN";
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

  if (request.cookies.has(ACCESS_COOKIE)) {
    return onSignIn && !staleSession ? toLanding() : proceed();
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return toSignIn();

  const session = await refreshSession(refreshToken);
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
  writeSession(response.cookies, session);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
