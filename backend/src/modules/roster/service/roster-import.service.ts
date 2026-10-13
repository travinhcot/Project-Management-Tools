import type {
  ImportMissingMember,
  ImportRowStatus,
  ImportRowView,
  RosterImportListItem,
  RosterImportSummary,
} from "../model/roster-import.model.ts";
import type { RosterImportRepository } from "../repository/roster-import.repository.ts";
import type { RosterProvisionService } from "./roster-provision.service.ts";
import type { Page, PageRequest } from "../../../shared/pagination.ts";

import type { RequestActor } from "../../../shared/request-actor.ts";

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

export function createRosterImportService(
  repository: RosterImportRepository,
  provisioner?: Pick<RosterProvisionService, "provisionImport">,
) {
  /**
   * `actor` set: a department admin only sees the imports they started themselves (a missing and
   * a foreign import answer alike, 404); the super-admin sees every import.
   */
  async function summary(
    importId: string,
    actor?: RequestActor,
  ): Promise<RosterImportSummary> {
    try {
      const found = await repository.getSummary(importId);
      if (actor?.role === "DEPT_ADMIN" && found.initiated_by_user_id !== actor.userId) {
        throw new HttpError(404, "IMPORT_NOT_FOUND", "Roster import not found.");
      }
      return found;
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
      actor?: RequestActor,
    ): Promise<Page<RosterImportListItem>> {
      try {
        const { rows, total } = await repository.listForSemester(
          semesterId,
          request.page,
          request.size,
          actor?.role === "DEPT_ADMIN" ? actor.userId : undefined,
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
      actor?: RequestActor,
    ): Promise<Page<ImportRowView>> {
      await summary(importId, actor); // 404 for an unknown (or foreign) import
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
      actor?: RequestActor,
    ): Promise<Page<ImportMissingMember>> {
      await summary(importId, actor);
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
        // The SQL refuses a foreign import for a department admin too.
        await repository.commit({
          actorId,
          importId,
          deactivateMissing,
          requestId,
        });
        const committed = await repository.getSummary(importId);
        // Accounts for the people just imported. Never throws: the import is already committed.
        const provisioning = await provisioner?.provisionImport(importId, {
          actorId,
          semesterId: committed.semester_id,
          requestId,
        });
        return provisioning ? { ...committed, provisioning } : committed;
      } catch (error) {
        throw importError(error);
      }
    },
  };
}

export type RosterImportService = ReturnType<typeof createRosterImportService>;
