/** Fields of a Postgres / PostgREST error that services map to HTTP errors. */
export interface DbErrorInfo {
  readonly code?: string;
  readonly message?: string;
}

export function dbError(error: unknown): DbErrorInfo {
  if (!error || typeof error !== "object") return {};
  const code =
    "code" in error && typeof error.code === "string" ? error.code : undefined;
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : undefined;
  return { code, message };
}
