/**
 * Metadata keys each event the audit module records on behalf of other modules may carry.
 * Anything else is dropped before it reaches the database (FR-AUD-01: allowlisted metadata;
 * never OTPs, tokens, cookies, signed URLs, keys or email bodies). The database additionally
 * strips obviously sensitive key names as a backstop.
 */
const ALLOWED_KEYS: Readonly<Record<string, readonly string[]>> = {
  AUTH_OTP_REQUESTED: ["email_hash"],
  AUTH_SIGN_IN_SUCCEEDED: ["email_hash", "role"],
  AUTH_SIGN_IN_FAILED: ["email_hash", "reason"],
  AUTH_SIGNED_OUT: [],
};

const SCALAR_LIMIT = 200;

/** Keeps only allowlisted, scalar, length-limited values. Unknown actions keep nothing. */
export function allowlistedMetadata(
  action: string,
  metadata: Readonly<Record<string, unknown>> | undefined,
): Record<string, string | number | boolean | null> {
  const allowed = ALLOWED_KEYS[action] ?? [];
  const result: Record<string, string | number | boolean | null> = {};
  for (const key of allowed) {
    const value = metadata?.[key];
    if (typeof value === "string") result[key] = value.slice(0, SCALAR_LIMIT);
    else if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    )
      result[key] = value;
  }
  return result;
}

/** Actions other modules may record through the port. Anything else is refused. */
export function isRecordableAction(action: string): boolean {
  return Object.hasOwn(ALLOWED_KEYS, action);
}
