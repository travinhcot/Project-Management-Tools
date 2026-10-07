"use server";

import { backendFetch } from "@/shared/api/backend";
import { ApiError } from "@/shared/api/errors";

export type DownloadResult =
  | { ok: true; url: string; filename: string }
  | { ok: false; message: string };

/** Signed links last a few minutes, so one is created per click rather than rendered into the page. */
export async function createDownloadUrl(
  projectId: string,
  fileId: string,
): Promise<DownloadResult> {
  try {
    const link = await backendFetch<{ url: string; filename: string }>(
      `/api/me/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/download-url`,
      { method: "POST" },
    );
    return { ok: true, url: link.url, filename: link.filename };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: "This file is not available right now. Try again later." };
    }
    throw error;
  }
}
