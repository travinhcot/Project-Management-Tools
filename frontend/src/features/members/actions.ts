"use server";

import { revalidatePath } from "next/cache";
import { backendFetch } from "@/shared/api/backend";
import { ApiError } from "@/shared/api/errors";
import type {
  ImportRowsPage,
  ImportRowStatus,
  ImportSummary,
  MissingMember,
} from "@/features/members/models/member";
import {
  fetchImportMissing,
  fetchImportRows,
  mapImportSummary,
  type ImportSummaryDto,
} from "@/features/members/service/members.service";

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

const MEMBERS_PATH = "/members";

/** Uploads the CSV as a raw body; the backend only reads text/csv, so the type is fixed here. */
export async function uploadRosterImport(
  semesterId: string,
  formData: FormData,
): Promise<ActionResult<{ summary: ImportSummary; ignoredColumns: string[] }>> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, code: "INVALID_INPUT", message: "Choose a CSV file to upload." };
  }
  return run(async () => {
    const data = await backendFetch<{
      import: ImportSummaryDto;
      ignored_columns: string[];
    }>(
      `/api/admin/semesters/${semesterId}/roster/imports?filename=${encodeURIComponent(file.name)}`,
      { method: "POST", rawBody: { data: await file.arrayBuffer(), contentType: "text/csv" } },
    );
    return { summary: mapImportSummary(data.import), ignoredColumns: data.ignored_columns };
  });
}

export async function getImportRows(
  importId: string,
  status: ImportRowStatus | "all",
  page: number,
): Promise<ActionResult<{ page: ImportRowsPage }>> {
  return run(async () => ({ page: await fetchImportRows(importId, status, page) }));
}

export async function getImportMissing(
  importId: string,
): Promise<ActionResult<{ members: MissingMember[] }>> {
  return run(async () => ({ members: await fetchImportMissing(importId) }));
}

export async function commitImport(
  importId: string,
  deactivateMissing: boolean,
): Promise<ActionResult<{ summary: ImportSummary }>> {
  const result = await run(async () => {
    const data = await backendFetch<{ import: ImportSummaryDto }>(
      `/api/admin/roster/imports/${importId}/commit`,
      { method: "POST", body: { deactivate_missing: deactivateMissing } },
    );
    return { summary: mapImportSummary(data.import) };
  });
  // Refresh on any outcome: an already-processed import means the list on screen was stale.
  revalidatePath(MEMBERS_PATH);
  return result;
}
