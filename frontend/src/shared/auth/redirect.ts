// Where to send a visitor after signing in. `next` comes from the URL, so it is only trusted
// when it is a path inside this app: no other origin, no protocol-relative "//host", no backslash.
export const DEFAULT_LANDING = "/overview";

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
