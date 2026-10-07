"use server";

import { revalidatePath } from "next/cache";
import { backendFetch } from "@/shared/api/backend";
import { ApiError } from "@/shared/api/errors";
import type {
  ProjectArchiveImpact,
  MemberRole,
  ProjectInput,
  ProjectMember,
  ProjectResources,
  RosterCandidate,
} from "@/features/projects/models/project";
import {
  fetchArchiveImpact,
  fetchProjectMembers,
  fetchProjectResources,
  fetchRosterCandidates,
  toBackendStatus,
  toBackendType,
} from "@/features/projects/service/projects.service";

export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; code: string; message: string };

/** Turns a backend ApiError into a result the form can show; anything else (incl. redirects) rethrows. */
async function run<T extends object>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, ...(await work()) };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, code: error.code, message: error.message };
    }
    throw error;
  }
}

const PROJECTS_PATH = "/projects";

export async function createProject(semesterId: string, input: ProjectInput): Promise<ActionResult> {
  return run(async () => {
    await backendFetch("/api/admin/projects", {
      method: "POST",
      body: {
        semester_id: semesterId,
        name: input.name,
        type: toBackendType(input.type),
        status: toBackendStatus(input.status),
        description: input.description || undefined,
      },
    });
    revalidatePath(PROJECTS_PATH);
    return {};
  });
}

/**
 * Sends only the fields that changed, with the updated_at the admin last saw. A stale copy
 * comes back as PROJECT_STALE; the route is revalidated either way so Reload shows fresh data.
 */
export async function updateProject(
  id: string,
  expectedUpdatedAt: string,
  changes: Partial<ProjectInput>,
): Promise<ActionResult> {
  const body: Record<string, unknown> = { expected_updated_at: expectedUpdatedAt };
  if (changes.name !== undefined) body.name = changes.name;
  if (changes.type !== undefined) body.type = toBackendType(changes.type);
  if (changes.status !== undefined) body.status = toBackendStatus(changes.status);
  if (changes.description !== undefined) body.description = changes.description || null;
  const result = await run(async () => {
    await backendFetch(`/api/admin/projects/${id}`, { method: "PATCH", body });
    return {};
  });
  revalidatePath(PROJECTS_PATH);
  return result;
}

export async function getArchiveImpact(
  id: string,
): Promise<ActionResult<{ impact: ProjectArchiveImpact }>> {
  return run(async () => ({ impact: await fetchArchiveImpact(id) }));
}

export async function archiveProject(id: string, cancelKickoff: boolean): Promise<ActionResult> {
  const result = await run(async () => {
    await backendFetch(`/api/admin/projects/${id}/archive`, {
      method: "POST",
      body: { cancel_kickoff: cancelKickoff },
    });
    return {};
  });
  revalidatePath(PROJECTS_PATH);
  return result;
}

export async function getProjectResources(
  id: string,
): Promise<ActionResult<{ resources: ProjectResources }>> {
  return run(async () => ({ resources: await fetchProjectResources(id) }));
}

export type ResourceSlotName = "FIRST_MEETING" | "BOM";

export async function saveResourceLink(
  id: string,
  slot: ResourceSlotName,
  link: { url: string; label: string | null },
): Promise<ActionResult> {
  return run(async () => {
    await backendFetch(`/api/admin/projects/${id}/resources/${slot}`, {
      method: "PUT",
      body: { url: link.url, label: link.label },
    });
    revalidatePath(PROJECTS_PATH);
    return {};
  });
}

export async function removeResource(id: string, slot: ResourceSlotName): Promise<ActionResult> {
  return run(async () => {
    await backendFetch(`/api/admin/projects/${id}/resources/${slot}`, { method: "DELETE" });
    revalidatePath(PROJECTS_PATH);
    return {};
  });
}

// The backend requires the exact Content-Type for each extension and checks the file's magic number.
const BOM_CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function uploadBomFile(id: string, formData: FormData): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, code: "INVALID_INPUT", message: "Choose a file to upload." };
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const contentType = BOM_CONTENT_TYPES[extension];
  if (!contentType) {
    return { ok: false, code: "UNSUPPORTED_FILE_TYPE", message: "Upload an .xlsx or .pdf file." };
  }
  return run(async () => {
    await backendFetch(
      `/api/admin/projects/${id}/resources/BOM/file?filename=${encodeURIComponent(file.name)}`,
      { method: "POST", rawBody: { data: await file.arrayBuffer(), contentType } },
    );
    revalidatePath(PROJECTS_PATH);
    return {};
  });
}

export async function getProjectMembers(
  id: string,
): Promise<ActionResult<{ members: ProjectMember[] }>> {
  return run(async () => ({ members: await fetchProjectMembers(id) }));
}

export async function searchRoster(
  semesterId: string,
  search: string,
): Promise<ActionResult<{ candidates: RosterCandidate[] }>> {
  return run(async () => ({ candidates: await fetchRosterCandidates(semesterId, search) }));
}

// Member writes change the list's member count and leader, so they revalidate /projects.
export async function addProjectMember(
  id: string,
  rosterMemberId: string,
  role: MemberRole = "MEMBER",
): Promise<ActionResult> {
  return run(async () => {
    await backendFetch(`/api/admin/projects/${id}/members`, {
      method: "POST",
      body: { roster_member_id: rosterMemberId, role },
    });
    revalidatePath(PROJECTS_PATH);
    return {};
  });
}

export async function setProjectMemberRole(
  id: string,
  rosterMemberId: string,
  role: MemberRole,
): Promise<ActionResult> {
  return run(async () => {
    await backendFetch(`/api/admin/projects/${id}/members/${rosterMemberId}`, {
      method: "PATCH",
      body: { role },
    });
    revalidatePath(PROJECTS_PATH);
    return {};
  });
}

export async function removeProjectMember(
  id: string,
  rosterMemberId: string,
): Promise<ActionResult> {
  return run(async () => {
    await backendFetch(`/api/admin/projects/${id}/members/${rosterMemberId}`, {
      method: "DELETE",
    });
    revalidatePath(PROJECTS_PATH);
    return {};
  });
}
