// Liveness check for the host's router and the backend's keep-alive ping, which targets the
// public URL. Deliberately does not call the backend or check the session.
export function GET() {
  return Response.json({ status: "ok" });
}
