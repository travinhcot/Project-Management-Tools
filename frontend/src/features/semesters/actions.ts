"use server";

import { revalidatePath } from "next/cache";
import { backendFetch } from "@/shared/api/backend";
import { ApiError } from "@/shared/api/errors";
import type { SemesterInput, SwitchImpact } from "@/features/semesters/models/semester";

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

const toBody = (input: SemesterInput) => ({
  term: input.term,
  year: input.year,
  starts_on: input.startsOn,
  ends_on: input.endsOn,
  demo_registration_url: input.demoRegistrationUrl,
});

export async function createSemester(input: SemesterInput): Promise<ActionResult> {
  return run(async () => {
    await backendFetch("/api/admin/semesters", { method: "POST", body: toBody(input) });
    revalidatePath("/semesters");
    return {};
  });
}

/** Sends every field; a null date or URL clears it on the backend. */
export async function updateSemester(id: string, input: SemesterInput): Promise<ActionResult> {
  return run(async () => {
    await backendFetch(`/api/admin/semesters/${id}`, { method: "PATCH", body: toBody(input) });
    revalidatePath("/semesters");
    return {};
  });
}

export async function getSwitchImpact(id: string): Promise<ActionResult<{ impact: SwitchImpact }>> {
  return run(async () => {
    const { impact } = await backendFetch<{
      impact: {
        members_losing_access: number;
        members_gaining_access: number;
        members_carried_over: number;
      };
    }>(`/api/admin/semesters/${id}/current-impact`);
    return {
      impact: {
        losing: impact.members_losing_access,
        gaining: impact.members_gaining_access,
        carryOver: impact.members_carried_over,
      },
    };
  });
}

export async function setCurrentSemester(id: string): Promise<ActionResult> {
  const result = await run(async () => {
    await backendFetch(`/api/admin/semesters/${id}/set-current`, { method: "POST" });
    return {};
  });
  // Refresh on conflict too: "already current" means the list on screen was stale.
  revalidatePath("/semesters");
  return result;
}
