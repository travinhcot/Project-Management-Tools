import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/shared/api/config";
import { ACCESS_COOKIE } from "@/shared/auth/session";

const FILTER_KEYS = ["action", "entity_type", "from", "to"];

/** Streams the filtered CSV (GET /api/admin/audit-events/export) with the admin's session. */
export async function GET(request: NextRequest) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.redirect(new URL("/sign-in", request.url));

  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) params.set(key, value);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE_URL}/api/admin/audit-events/export?${params}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return new NextResponse("The server could not be reached.", { status: 503 });
  }
  if (upstream.status === 401) return NextResponse.redirect(new URL("/sign-in", request.url));
  if (!upstream.ok) return new NextResponse("The export failed.", { status: upstream.status });

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="audit-events.csv"',
      "Cache-Control": "no-store",
    },
  });
}
