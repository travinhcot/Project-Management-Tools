// Server-only client for the Express backend. Import it from Server Components and
// Server Actions, never from a "use client" file (it reads httpOnly cookies).
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE } from "@/shared/auth/session";
import { API_BASE_URL } from "@/shared/api/config";
import { ApiError, toApiError } from "@/shared/api/errors";

interface BackendRequest {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

/**
 * Calls an authenticated backend route. A missing or rejected token (401) sends the visitor
 * to /sign-in; every other failure throws an ApiError carrying the backend's code and message.
 */
export async function backendFetch<T>(
  path: string,
  { method = "GET", body }: BackendRequest = {},
): Promise<T> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect("/sign-in");

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(503, "BACKEND_UNREACHABLE", "The server could not be reached. Try again in a moment.");
  }

  if (response.status === 401) redirect("/sign-in");
  if (!response.ok) throw await toApiError(response);
  return (response.status === 204 ? undefined : await response.json()) as T;
}
