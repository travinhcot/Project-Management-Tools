"use server";

import { revalidatePath } from "next/cache";
import { backendFetch } from "@/shared/api/backend";
import { ApiError } from "@/shared/api/errors";
import type { DepartmentCode } from "@/config/departments";
import type { DepartmentResource } from "@/features/department-resources/models/department-resource";
import { mapResource } from "@/features/department-resources/service/department-resources.service";
import {
  CONTENT_TYPES,
  validateFile,
} from "@/features/department-resources/models/department-resource";

export type ActionResult = { ok: true } | { ok: false; message: string };

async function run(work: () => Promise<void>): Promise<ActionResult> {
  try {
    await work();
    revalidatePath("/department-resources");
    revalidatePath("/member/department-resources");
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    throw error;
  }
}

interface Fields {
  title: string;
  category: string;
  description: string;
}

export async function addLink(
  department: DepartmentCode | null,
  input: Fields & { url: string },
): Promise<ActionResult> {
  return run(async () => {
    await backendFetch("/api/department-resources/links", {
      method: "POST",
      body: {
        department: department ?? undefined,
        title: input.title,
        category: input.category || undefined,
        description: input.description || undefined,
        url: input.url,
      },
    });
  });
}

/** Sends only what changed; an empty description clears it. */
export async function updateResource(
  department: DepartmentCode | null,
  id: string,
  changes: Partial<Fields & { url: string }>,
): Promise<ActionResult> {
  return run(async () => {
    await backendFetch(`/api/department-resources/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: {
        department: department ?? undefined,
        ...changes,
        ...(changes.description !== undefined ? { description: changes.description || null } : {}),
      },
    });
  });
}

export async function removeResource(
  department: DepartmentCode | null,
  id: string,
): Promise<ActionResult> {
  return run(async () => {
    const query = department ? `?department=${department}` : "";
    await backendFetch(`/api/department-resources/${encodeURIComponent(id)}${query}`, {
      method: "DELETE",
    });
  });
}

/**
 * Uploads a file. FormData carries `file`, and `title` (required for a new resource), `category`,
 * `description` and `resourceId` (set to replace the source of an existing resource).
 */
export async function uploadResource(
  department: DepartmentCode | null,
  formData: FormData,
): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, message: "Choose a file to upload." };
  const problem = validateFile(file);
  if (problem) return { ok: false, message: problem };
  const contentType = CONTENT_TYPES[file.name.split(".").pop()!.toLowerCase()];

  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const params = new URLSearchParams({ filename: file.name });
  if (department) params.set("department", department);
  if (text("resourceId")) params.set("resource_id", text("resourceId"));
  if (text("title")) params.set("title", text("title"));
  if (text("category")) params.set("category", text("category"));
  if (text("description")) params.set("description", text("description"));

  return run(async () => {
    await backendFetch(`/api/department-resources/files?${params}`, {
      method: "POST",
      rawBody: { data: await file.arrayBuffer(), contentType },
    });
  });
}

export type DownloadResult = { ok: true; url: string } | { ok: false; message: string };

/** Signed links last a few minutes, so one is created per click. */
export async function createDownload(
  department: DepartmentCode | null,
  id: string,
): Promise<DownloadResult> {
  try {
    const query = department ? `?department=${department}` : "";
    const link = await backendFetch<{ url: string }>(
      `/api/department-resources/${encodeURIComponent(id)}/download-url${query}`,
      { method: "POST" },
    );
    return { ok: true, url: link.url };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: "This file is not available right now. Try again later." };
    }
    throw error;
  }
}

export type ProjectLinksResult =
  | { ok: true; resources: DepartmentResource[]; linkedIds: string[] }
  | { ok: false; message: string };

interface ProjectLinksDto {
  resource_ids: string[];
  resources: Parameters<typeof mapResource>[0][];
}

function toLinks(dto: ProjectLinksDto): ProjectLinksResult {
  return { ok: true, resources: dto.resources.map(mapResource), linkedIds: dto.resource_ids };
}

/** The project's department library plus the entries the project links to. */
export async function getProjectDepartmentResources(projectId: string): Promise<ProjectLinksResult> {
  try {
    return toLinks(
      await backendFetch<ProjectLinksDto>(
        `/api/department-resources/projects/${encodeURIComponent(projectId)}`,
      ),
    );
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    throw error;
  }
}

/** Replaces the whole list of library entries linked to the project (staff only). */
export async function setProjectDepartmentResources(
  projectId: string,
  resourceIds: string[],
): Promise<ProjectLinksResult> {
  try {
    const result = toLinks(
      await backendFetch<ProjectLinksDto>(
        `/api/department-resources/projects/${encodeURIComponent(projectId)}`,
        { method: "PUT", body: { resource_ids: resourceIds } },
      ),
    );
    revalidatePath("/projects");
    revalidatePath("/member/projects", "layout");
    return result;
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    throw error;
  }
}
