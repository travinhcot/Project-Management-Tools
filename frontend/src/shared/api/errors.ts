/** Backend error envelope: `{ error: { code, message } }` (backend/src/shared/http-error.ts). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    return new ApiError(
      response.status,
      body.error?.code ?? "UNKNOWN_ERROR",
      body.error?.message ?? "The request failed.",
    );
  } catch {
    return new ApiError(response.status, "UNKNOWN_ERROR", "The request failed.");
  }
}
