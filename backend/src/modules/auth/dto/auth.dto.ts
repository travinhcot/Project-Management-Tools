import { HttpError } from "../../../shared/http-error.ts";

function invalid(message: string): never {
  throw new HttpError(400, "INVALID_INPUT", message);
}

export function bodyFields(body: unknown, keys: readonly string[]): Record<string, unknown> {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !keys.includes(key))
  ) {
    invalid("The request contains invalid fields.");
  }
  return body as Record<string, unknown>;
}

/** Comma-separated ALLOWED_EMAIL_DOMAINS; empty or unset means any domain is accepted. */
function allowedEmailDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export function emailInput(value: unknown): string {
  if (typeof value !== "string") invalid("A valid email is required.");
  const email = value.trim().toLowerCase();
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    invalid("A valid email is required.");
  const domains = allowedEmailDomains();
  if (domains.length && !domains.includes(email.slice(email.lastIndexOf("@") + 1))) {
    throw new HttpError(
      400,
      "EMAIL_DOMAIN_NOT_ALLOWED",
      `Use your school email (${domains.map((domain) => `@${domain}`).join(", ")}).`,
    );
  }
  return email;
}

export function otpInput(value: unknown): string {
  if (typeof value !== "string" || !/^\d{6,10}$/.test(value))
    invalid("A valid email code is required.");
  return value;
}

export function refreshTokenInput(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.length ||
    value.length > 8192 ||
    /\s/.test(value)
  ) {
    invalid("A refresh token is required.");
  }
  return value;
}

export function fullNameInput(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    [...value.trim()].length > 200 ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    invalid("Full name must contain 1–200 characters.");
  return value.trim();
}
