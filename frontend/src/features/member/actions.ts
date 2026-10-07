"use server";

import { backendFetch } from "@/shared/api/backend";
import { ApiError } from "@/shared/api/errors";
import type { Teammate } from "@/features/member/models/member";
import { getMemberProject } from "@/features/member/service/member.service";

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

export type TeammatesResult =
  | { ok: true; teammates: Teammate[] }
  | { ok: false; message: string };

/** Names for the expandable team list on My projects; the detail route already scopes it to the member's own projects. */
export async function getProjectTeammates(projectId: string): Promise<TeammatesResult> {
  try {
    const project = await getMemberProject(projectId);
    return { ok: true, teammates: project.teammates };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: "Could not load the team. Try again later." };
    }
    throw error;
  }
}
