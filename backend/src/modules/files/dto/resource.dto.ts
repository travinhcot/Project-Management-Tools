import type { Request } from "express";

import {
  invalid,
  objectBody,
  rejectUnknownKeys,
  single,
} from "../../../shared/query-params.ts";

export interface LinkRequest {
  readonly url: string;
  readonly label: string | null;
}

/** `{ url, label? }` - url must be an absolute https:// URL. */
export function linkBody(body: unknown): LinkRequest {
  const input = objectBody(body);
  rejectUnknownKeys(
    input,
    ["url", "label"],
    "Only url and label can be provided.",
  );
  if (typeof input.url !== "string") invalid("url is required.");
  const url = input.url.trim();
  let protocol = "";
  let hostname = "";
  try {
    const parsed = new URL(url);
    protocol = parsed.protocol;
    hostname = parsed.hostname;
  } catch {
    invalid("url must be a valid https:// URL.");
  }
  if (protocol !== "https:" || !hostname || url.length > 2048)
    invalid("url must be a valid https:// URL (at most 2048 characters).");
  let label: string | null = null;
  if (input.label !== undefined && input.label !== null) {
    if (typeof input.label !== "string") invalid("label must be text.");
    label = input.label.trim() || null;
    if (label !== null && [...label].length > 100)
      invalid("label must be at most 100 characters.");
  }
  return { url, label };
}

/** `?filename=` - base name only, no control characters, with an extension. */
export function uploadFilename(req: Request<{ projectId: string; slot: string }>): string {
  const query = req.query as Record<string, unknown>;
  rejectUnknownKeys(
    query,
    ["filename"],
    "The request contains invalid query parameters.",
  );
  const raw = single(query, "filename");
  if (raw === undefined) invalid("Query parameter filename is required.");
  const base = raw.split(/[\\/]/).pop()!.trim();
  // eslint-disable-next-line no-control-regex
  if (!base || [...base].length > 255 || /[\u0000-\u001f\u007f]/.test(base)) {
    invalid("filename must be 1-255 characters without control characters.");
  }
  if (!/\.[A-Za-z0-9]{1,10}$/.test(base))
    invalid("filename needs a file extension.");
  return base;
}
