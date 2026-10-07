// Where to send a visitor after signing in. `next` comes from the URL, so it is only trusted
// when it is a path inside this app: no other origin, no protocol-relative "//host", no backslash.
export const DEFAULT_LANDING = "/overview";
export const MEMBER_LANDING = "/member/overview";
export const MEMBER_AREA = "/member";

type Role = "ADMIN" | "MEMBER";

export function isMemberPath(path: string): boolean {
  return path === MEMBER_AREA || path.startsWith(`${MEMBER_AREA}/`);
}

export function landingFor(role: Role): string {
  return role === "MEMBER" ? MEMBER_LANDING : DEFAULT_LANDING;
}

/** `next` is honoured only when it sits in the area the role may use. */
export function resolveLanding(role: Role, value: string | string[] | null | undefined): string {
  const next = safeNextPath(value);
  const inArea = role === "MEMBER" ? isMemberPath(next) : !isMemberPath(next);
  return inArea && next !== DEFAULT_LANDING ? next : landingFor(role);
}

export function safeNextPath(value: string | string[] | null | undefined): string {
  const next = Array.isArray(value) ? value[0] : value;
  if (
    !next ||
    next.length > 500 ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\") ||
    next.startsWith("/sign-in")
  ) {
    return DEFAULT_LANDING;
  }
  return next;
}
