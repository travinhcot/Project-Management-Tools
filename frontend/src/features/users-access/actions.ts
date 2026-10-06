"use server";

import { revalidatePath } from "next/cache";
import { backendFetch } from "@/shared/api/backend";
import { ApiError } from "@/shared/api/errors";
import type { AccessChange } from "@/features/users-access/models/user";

export type ActionResult = { ok: true } | { ok: false; code: string; message: string };

/** Changes a user's role and/or active flag (PATCH /api/admin/users/:id). */
export async function updateUserAccess(id: string, change: AccessChange): Promise<ActionResult> {
  try {
    await backendFetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: { role: change.role, is_active: change.isActive },
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, code: error.code, message: error.message };
    throw error;
  } finally {
    // Refresh on failure too: a conflict usually means the list on screen was stale.
    revalidatePath("/users-access");
  }
}
