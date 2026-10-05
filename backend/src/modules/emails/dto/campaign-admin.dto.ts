import type {
  CampaignKind,
  CampaignListQuery,
  CampaignStatus,
  DeliveryListQuery,
  DeliveryStatus,
  ResolveAction,
} from "../model/email.model.ts";

import {
  invalid,
  objectBody,
  rejectUnknownKeys,
  searchQuery,
  single,
} from "../../../shared/query-params.ts";
import { pageOf } from "../../../shared/pagination.ts";
import { semesterIdParam } from "../common/email-params.ts";
import {
  CAMPAIGN_KINDS,
  CAMPAIGN_STATUSES,
  DELIVERY_STATUSES,
  RESOLVE_ACTIONS,
} from "../model/email.model.ts";

const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** A date-only schedule means 09:00 in Asia/Ho_Chi_Minh (UTC+7, no DST). */
const DEFAULT_TIME = "T09:00:00+07:00";

function enumValue<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  label: string,
): T | undefined {
  if (value === undefined) return undefined;
  if (!allowed.includes(value as T)) invalid(`${label} is not a valid value.`);
  return value as T;
}

function scheduledAtValue(value: unknown): string {
  if (typeof value !== "string") invalid("scheduled_at is required.");
  const text = value.trim();
  const iso = DATE_PATTERN.test(text) ? `${text}${DEFAULT_TIME}` : text;
  if (
    (!DATE_PATTERN.test(text) && !TIMESTAMP_PATTERN.test(text)) ||
    Number.isNaN(Date.parse(iso))
  ) {
    invalid("scheduled_at must be a date (YYYY-MM-DD) or an ISO timestamp.");
  }
  return iso;
}

/** Body for schedule and reschedule: { "scheduled_at": "2026-10-10" }. */
export function scheduleBody(body: unknown): { scheduledAt: string } {
  const input = objectBody(body);
  rejectUnknownKeys(
    input,
    ["scheduled_at"],
    "Only scheduled_at can be provided.",
  );
  return { scheduledAt: scheduledAtValue(input.scheduled_at) };
}

/** Body for kick-off and demo: exactly one of { "scheduled_at": ... } or { "send_now": true }. */
export function scheduleOrSendNowBody(body: unknown): {
  scheduledAt: string | null;
  sendNow: boolean;
} {
  const input = objectBody(body);
  rejectUnknownKeys(
    input,
    ["scheduled_at", "send_now"],
    "Only scheduled_at or send_now can be provided.",
  );
  if (input.send_now !== undefined && typeof input.send_now !== "boolean") {
    invalid("send_now must be true or false.");
  }
  const sendNow = input.send_now === true;
  if (sendNow === (input.scheduled_at !== undefined)) {
    invalid("Provide either scheduled_at or send_now: true.");
  }
  return {
    scheduledAt: sendNow ? null : scheduledAtValue(input.scheduled_at),
    sendNow,
  };
}

export function resolveBody(body: unknown): { action: ResolveAction } {
  const input = objectBody(body);
  rejectUnknownKeys(input, ["action"], "Only action can be provided.");
  if (
    typeof input.action !== "string" ||
    !RESOLVE_ACTIONS.includes(input.action as ResolveAction)
  ) {
    invalid("action must be MARK_SENT or RETRY.");
  }
  return { action: input.action as ResolveAction };
}

export function listCampaignsQuery(
  query: Record<string, unknown>,
): CampaignListQuery {
  rejectUnknownKeys(
    query,
    ["semesterId", "kind", "status", "page", "size"],
    "The request contains invalid query parameters.",
  );
  const semesterId = single(query, "semesterId");
  return {
    semesterId:
      semesterId === undefined ? undefined : semesterIdParam(semesterId),
    kind: enumValue<CampaignKind>(
      single(query, "kind"),
      CAMPAIGN_KINDS,
      "kind",
    ),
    status: enumValue<CampaignStatus>(
      single(query, "status"),
      CAMPAIGN_STATUSES,
      "status",
    ),
    ...pageOf(query),
  };
}

export function listDeliveriesQuery(
  query: Record<string, unknown>,
): DeliveryListQuery {
  rejectUnknownKeys(
    query,
    ["status", "search", "page", "size"],
    "The request contains invalid query parameters.",
  );
  return {
    status: enumValue<DeliveryStatus>(
      single(query, "status"),
      DELIVERY_STATUSES,
      "status",
    ),
    search: searchQuery(query),
    ...pageOf(query, 50),
  };
}
