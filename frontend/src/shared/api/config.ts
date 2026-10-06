/** Server-only: the Express backend. Never exposed to the browser (no NEXT_PUBLIC_ prefix). */
export const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3001";
