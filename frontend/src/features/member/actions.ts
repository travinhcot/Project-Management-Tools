"use server";

import { revalidatePath } from "next/cache";
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

export type SubmitResult = { ok: true } | { ok: false; message: string };

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_PACKAGE_BYTES = 10 * 1024 * 1024;

/**
 * Submits (or replaces) the final package of an event or content project: an Excel workbook.
 * The backend checks the assignment, the file type and its content; this only fails fast.
 */
export async function submitFinalPackage(
  projectId: string,
  formData: FormData,
): Promise<SubmitResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an Excel file (.xlsx) to submit." };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { ok: false, message: "The final package must be an Excel file (.xlsx)." };
  }
  if (file.size > MAX_PACKAGE_BYTES) {
    return { ok: false, message: "The file must be 10 MB or smaller." };
  }
  try {
    await backendFetch(
      `/api/me/projects/${encodeURIComponent(projectId)}/final-package?filename=${encodeURIComponent(file.name)}`,
      { method: "POST", rawBody: { data: await file.arrayBuffer(), contentType: XLSX_TYPE } },
    );
    revalidatePath(`/member/projects/${projectId}`);
    revalidatePath("/member/projects");
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) {
      // Unknown project and "not on this team" look the same on purpose.
      if (error.status === 404) return { ok: false, message: "You cannot submit for this project." };
      return { ok: false, message: error.message };
    }
    throw error;
  }
}
