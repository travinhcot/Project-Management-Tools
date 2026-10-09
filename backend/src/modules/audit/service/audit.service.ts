import type { AuditRepository } from "../repository/audit.repository.ts";
import type {
  AuditEvent,
  AuditEventRow,
  AuditFilterValues,
  AuditListQuery,
  AuditRecordInput,
  FieldChange,
} from "../model/audit.model.ts";
import type { Page } from "../../../shared/pagination.ts";

import { neutralizeFormula } from "../../../shared/csv-safety.ts";
import { auditError, EVENT_NOT_FOUND } from "../common/audit-errors.ts";
import {
  allowlistedMetadata,
  isRecordableAction,
} from "../common/audit-metadata.ts";
import {
  DEFAULT_RETENTION_DAYS,
  EXPORT_LIMIT,
  RETENTION_BATCH,
} from "../model/audit.model.ts";

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Fields whose value differs between metadata.before and metadata.after. */
export function diffOf(
  metadata: Readonly<Record<string, unknown>>,
): FieldChange[] {
  const { before, after } = metadata;
  if (!isObject(before) || !isObject(after)) return [];
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return fields
    .filter(
      (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
    )
    .sort()
    .map((field) => ({
      field,
      before: before[field] ?? null,
      after: after[field] ?? null,
    }));
}

function toEvent(row: AuditEventRow): AuditEvent {
  const { actor_user_id, actor_email, actor_name, ...rest } = row;
  return {
    ...rest,
    actor: actor_user_id
      ? { id: actor_user_id, email: actor_email, full_name: actor_name }
      : null,
    diff: diffOf(row.metadata),
  };
}

/** Spreadsheet formulas must stay text: prefix risky leading characters, then quote. */
export function csvCell(value: unknown): string {
  const text = neutralizeFormula(
    value === null || value === undefined ? "" : String(value),
  );
  return `"${text.replaceAll('"', '""')}"`;
}

const LOCAL_FORMAT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Ho_Chi_Minh",
  dateStyle: "short",
  timeStyle: "medium",
});

export const CSV_HEADER = [
  "occurred_at_utc",
  "occurred_at_local",
  "actor_email",
  "actor_name",
  "action",
  "entity_type",
  "entity_id",
  "semester_id",
  "request_id",
  "metadata",
] as const;

export function csvRow(event: AuditEvent): string {
  return [
    event.occurred_at,
    LOCAL_FORMAT.format(new Date(event.occurred_at)),
    event.actor?.email,
    event.actor?.full_name,
    event.action,
    event.entity_type,
    event.entity_id,
    event.semester_id,
    event.request_id,
    JSON.stringify(event.metadata),
  ]
    .map(csvCell)
    .join(",");
}

export function createAuditService(
  repository: AuditRepository,
  options: { retentionDays?: number } = {},
) {
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;
  if (!Number.isInteger(retentionDays) || retentionDays < 30)
    throw new Error(
      "AUDIT_RETENTION_DAYS must be a whole number of at least 30.",
    );

  return {
    /**
     * Port for other modules (auth). Only allowlisted actions and metadata are kept, and a
     * failure never reaches the caller: a broken audit write must not block a sign-in.
     */
    async record(input: AuditRecordInput): Promise<void> {
      if (!isRecordableAction(input.action)) return;
      try {
        await repository.record({
          ...input,
          metadata: allowlistedMetadata(input.action, input.metadata),
        });
      } catch (error) {
        console.error(
          "Audit write failed:",
          input.action,
          error instanceof Error ? error.name : "error",
        );
      }
    },

    async list(
      actorId: string,
      query: AuditListQuery,
    ): Promise<Page<AuditEvent>> {
      try {
        const { page, size, ...filters } = query;
        const { rows, total } = await repository.list(
          actorId,
          filters,
          size,
          (page - 1) * size,
        );
        return { items: rows.map(toEvent), page, size, total };
      } catch (error) {
        throw auditError(error);
      }
    },

    async get(actorId: string, eventId: string): Promise<AuditEvent> {
      let row: AuditEventRow | null;
      try {
        row = await repository.get(actorId, eventId);
      } catch (error) {
        throw auditError(error);
      }
      if (!row) throw EVENT_NOT_FOUND;
      return toEvent(row);
    },

    async filterValues(actorId: string): Promise<AuditFilterValues> {
      try {
        return await repository.filterValues(actorId);
      } catch (error) {
        throw auditError(error);
      }
    },

    /** CSV text with the same filters as the list; capped at EXPORT_LIMIT rows. */
    async exportCsv(
      actorId: string,
      filters: Omit<AuditListQuery, "page" | "size">,
    ): Promise<{ csv: string; rows: number; truncated: boolean }> {
      try {
        const { rows, total } = await repository.list(
          actorId,
          filters,
          EXPORT_LIMIT,
          0,
        );
        const lines = [
          CSV_HEADER.map(csvCell).join(","),
          ...rows.map((r) => csvRow(toEvent(r))),
        ];
        return {
          csv: `﻿${lines.join("\r\n")}\r\n`,
          rows: rows.length,
          truncated: total > rows.length,
        };
      } catch (error) {
        throw auditError(error);
      }
    },

    /** One batch of the D-11 retention purge. `more` tells the scheduler to call again. */
    async purgeExpired(
      requestId: string,
    ): Promise<{ deleted: number; more: boolean }> {
      try {
        const deleted = await repository.purgeExpired(
          retentionDays,
          RETENTION_BATCH,
          requestId,
        );
        return { deleted, more: deleted === RETENTION_BATCH };
      } catch (error) {
        throw auditError(error);
      }
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
