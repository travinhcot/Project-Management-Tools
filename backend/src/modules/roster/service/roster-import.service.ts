import type {
  ImportMissingMember,
  ImportRowStatus,
  ImportRowView,
  RosterImportListItem,
  RosterImportSummary,
} from "../model/roster-import.model.ts";
import type { RosterImportRepository } from "../repository/roster-import.repository.ts";
import type { Page, PageRequest } from "../../../shared/pagination.ts";

import { createHash } from "node:crypto";
import { HttpError } from "../../../shared/http-error.ts";
import { importError } from "../common/import-errors.ts";
import { RosterCsvError, parseRosterCsv } from "../csv/roster-csv.ts";

/** A preview that is past its expiry reads as EXPIRED even before any cleanup job runs. */
function effective<T extends RosterImportListItem>(item: T): T {
  if (
    item.status === "PREVIEWED" &&
    item.expires_at &&
    Date.parse(item.expires_at) <= Date.now()
  ) {
    return { ...item, status: "EXPIRED" };
  }
  return item;
}

export function createRosterImportService(repository: RosterImportRepository) {
  async function summary(importId: string): Promise<RosterImportSummary> {
    try {
      return await repository.getSummary(importId);
    } catch (error) {
      throw importError(error);
    }
  }

  return {
    /** FR-ROS-01: parse + validate + store a preview. Nothing touches roster_members. */
    async createPreview(input: {
      actorId: string;
      semesterId: string;
      filename: string;
      bytes: Buffer;
      requestId: string;
    }): Promise<{ import: RosterImportSummary; ignored_columns: string[] }> {
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
      } catch {
        throw new HttpError(
          400,
          "INVALID_CSV",
          "The file must be UTF-8 encoded.",
        );
      }
      let parsed;
      try {
        parsed = parseRosterCsv(text);
      } catch (error) {
        if (error instanceof RosterCsvError)
          throw new HttpError(400, "INVALID_CSV", error.message);
        throw error;
      }
      try {
        const importId = await repository.createPreview({
          actorId: input.actorId,
          semesterId: input.semesterId,
          filename: input.filename,
          checksum: createHash("sha256").update(input.bytes).digest("hex"),
          rows: parsed.rows,
          requestId: input.requestId,
        });
        return {
          import: await repository.getSummary(importId),
          ignored_columns: parsed.ignored_columns,
        };
      } catch (error) {
        throw importError(error);
      }
    },

    getSummary: summary,

    async history(
      semesterId: string,
      request: PageRequest,
    ): Promise<Page<RosterImportListItem>> {
      try {
        const { rows, total } = await repository.listForSemester(
          semesterId,
          request.page,
          request.size,
        );
        return {
          items: rows.map(effective),
          page: request.page,
          size: request.size,
          total,
        };
      } catch (error) {
        throw importError(error);
      }
    },

    async rows(
      importId: string,
      status: ImportRowStatus | undefined,
      request: PageRequest,
    ): Promise<Page<ImportRowView>> {
      await summary(importId); // 404 for an unknown import
      try {
        const { rows, total } = await repository.listRows(
          importId,
          status,
          request.page,
          request.size,
        );
        return { items: rows, page: request.page, size: request.size, total };
      } catch (error) {
        throw importError(error);
      }
    },

    async missing(
      importId: string,
      request: PageRequest,
    ): Promise<Page<ImportMissingMember>> {
      try {
        const { rows, total } = await repository.listMissing(
          importId,
          request.page,
          request.size,
        );
        return { items: rows, page: request.page, size: request.size, total };
      } catch (error) {
        throw importError(error);
      }
    },

    async commit(
      actorId: string,
      importId: string,
      deactivateMissing: boolean,
      requestId: string,
    ): Promise<RosterImportSummary> {
      try {
        await repository.commit({
          actorId,
          importId,
          deactivateMissing,
          requestId,
        });
        return await repository.getSummary(importId);
      } catch (error) {
        throw importError(error);
      }
    },
  };
}

export type RosterImportService = ReturnType<typeof createRosterImportService>;
