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

export function emailInput(value: unknown): string {
  if (typeof value !== "string") invalid("A valid email is required.");
  const email = value.trim().toLowerCase();
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    invalid("A valid email is required.");
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
