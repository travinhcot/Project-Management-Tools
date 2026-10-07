"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_BASE_URL } from "@/shared/api/config";
import { resolveLanding } from "@/shared/auth/redirect";
import {
  ACCESS_COOKIE,
  clearSession,
  writeSession,
  type BackendSession,
} from "@/shared/auth/session";

export type AuthResult =
  | { ok: true }
  | { ok: false; code: "INVALID_INPUT" | "INVALID_CODE" | "NO_ACCESS" | "UNAVAILABLE"; message: string };

const UNAVAILABLE: AuthResult = {
  ok: false,
  code: "UNAVAILABLE",
  message: "Sign-in is temporarily unavailable. Try again in a moment.",
};

async function post(path: string, body?: unknown, token?: string): Promise<Response | null> {
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      cache: "no-store",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return null;
  }
}

/** The backend answers 202 with the same message whether or not the email may sign in. */
export async function requestOtp(email: string): Promise<AuthResult> {
  const response = await post("/api/auth/otp", { email: email.trim() });
  if (!response) return UNAVAILABLE;
  if (response.status === 400) {
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    const message =
      body?.error?.code === "EMAIL_DOMAIN_NOT_ALLOWED" && body.error.message
        ? body.error.message
        : "Enter a valid email address.";
    return { ok: false, code: "INVALID_INPUT", message };
  }
  if (!response.ok) return UNAVAILABLE;
  return { ok: true };
}

/** On success this sets the session cookies and redirects to the role's area; it only returns on failure. */
export async function verifyOtp(
  email: string,
  code: string,
  next?: string,
): Promise<AuthResult> {
  const response = await post("/api/auth/verify", { email: email.trim(), token: code });
  if (!response) return UNAVAILABLE;
  if (response.status === 400 || response.status === 401) {
    return {
      ok: false,
      code: "INVALID_CODE",
      message: "That code is wrong or has expired. Try again or request a new one.",
    };
  }
  if (response.status === 403) {
    return { ok: false, code: "NO_ACCESS", message: "This account cannot sign in." };
  }
  if (!response.ok) return UNAVAILABLE;

  const body = (await response.json()) as {
    user: { role: "ADMIN" | "MEMBER" };
    session: BackendSession;
  };

  writeSession(await cookies(), body.session, body.user.role);
  redirect(resolveLanding(body.user.role, next));
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (token) await post("/api/auth/logout", undefined, token);
  clearSession(store);
  redirect("/sign-in");
}
