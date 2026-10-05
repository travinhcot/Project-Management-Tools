import type { AuditListQuery } from "../model/audit.model.ts";

import {
  invalid,
  rejectUnknownKeys,
  single,
  uuidParam,
} from "../../../shared/query-params.ts";
import { pageOf } from "../../../shared/pagination.ts";

const NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
/** SR-6: people read times in Asia/Ho_Chi_Minh (UTC+7, no DST). */
const LOCAL_OFFSET = "+07:00";

export const FILTER_KEYS = [
  "actor",
  "action",
  "entity_type",
  "entity_id",
  "semester_id",
  "from",
  "to",
] as const;

function nameFilter(value: string | undefined, label: string) {
  if (value === undefined) return undefined;
  if (!NAME_PATTERN.test(value))
    invalid(`${label} must look like PROJECT_CREATED.`);
  return value;
}

/** A calendar day (YYYY-MM-DD) as the UTC instant of its local midnight. */
function dayStart(value: string, label: string, plusDays = 0): string {
  const match = DAY_PATTERN.exec(value);
  const date = match
    ? new Date(
        Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
      )
    : null;
  if (
    !match ||
    !date ||
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    invalid(`${label} must be a date like 2026-10-04.`);
  }
  date.setUTCDate(date.getUTCDate() + plusDays);
  const day = date.toISOString().slice(0, 10);
  return new Date(`${day}T00:00:00${LOCAL_OFFSET}`).toISOString();
}

/** Filters shared by the list and export endpoints. */
export function auditFilters(
  query: Record<string, unknown>,
): Omit<AuditListQuery, "page" | "size"> {
  const actor = single(query, "actor");
  const entityId = single(query, "entity_id");
  const semesterId = single(query, "semester_id");
  const from = single(query, "from");
  const to = single(query, "to");
  const fromInstant = from === undefined ? undefined : dayStart(from, "from");
  // "to" is a whole day, so the exclusive end is the next local midnight.
  const toInstant = to === undefined ? undefined : dayStart(to, "to", 1);
  if (fromInstant && toInstant && fromInstant >= toInstant)
    invalid("from must not be after to.");
  return {
    actor: actor === undefined ? undefined : uuidParam(actor, "actor id"),
    action: nameFilter(single(query, "action"), "action"),
    entity_type: nameFilter(single(query, "entity_type"), "entity_type"),
    entity_id:
      entityId === undefined ? undefined : uuidParam(entityId, "entity id"),
    semester_id:
      semesterId === undefined
        ? undefined
        : uuidParam(semesterId, "semester id"),
    from: fromInstant,
    to: toInstant,
  };
}

export function listAuditQuery(query: Record<string, unknown>): AuditListQuery {
  rejectUnknownKeys(
    query,
    [...FILTER_KEYS, "page", "size"],
    "The request contains invalid query parameters.",
  );
  return { ...auditFilters(query), ...pageOf(query) };
}

export function exportAuditQuery(
  query: Record<string, unknown>,
): Omit<AuditListQuery, "page" | "size"> {
  rejectUnknownKeys(
    query,
    FILTER_KEYS,
    "The request contains invalid query parameters.",
  );
  return auditFilters(query);
}

export function eventIdParam(value: unknown): string {
  return uuidParam(value, "audit event id");
}
