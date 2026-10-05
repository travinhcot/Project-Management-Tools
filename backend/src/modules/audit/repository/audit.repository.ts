import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AuditEventRow,
  AuditFilterValues,
  AuditListQuery,
  AuditRecordInput,
} from "../model/audit.model.ts";

function asRows(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data))
    throw new TypeError("Unexpected database response.");
  return data as Record<string, unknown>[];
}

function toRow(row: Record<string, unknown>): AuditEventRow {
  const metadata = row.metadata;
  return {
    id: String(row.id),
    actor_user_id: (row.actor_user_id as string | null) ?? null,
    actor_email: (row.actor_email as string | null) ?? null,
    actor_name: (row.actor_name as string | null) ?? null,
    action: String(row.action),
    entity_type: String(row.entity_type),
    entity_id: (row.entity_id as string | null) ?? null,
    semester_id: (row.semester_id as string | null) ?? null,
    metadata:
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {},
    request_id: (row.request_id as string | null) ?? null,
    occurred_at: String(row.occurred_at),
  };
}

export function createAuditRepository(client: SupabaseClient) {
  return {
    async record(
      input: AuditRecordInput & { metadata: Record<string, unknown> },
    ): Promise<void> {
      const { error } = await client.rpc("audit_record_event", {
        p_actor_id: input.actorId,
        p_action: input.action,
        p_entity_type: input.entityType,
        p_entity_id: input.entityId ?? null,
        p_semester_id: input.semesterId ?? null,
        p_metadata: input.metadata,
        p_request_id: input.requestId,
      });
      if (error) throw error;
    },

    async list(
      actorId: string,
      query: Omit<AuditListQuery, "page" | "size">,
      limit: number,
      offset: number,
    ): Promise<{ rows: AuditEventRow[]; total: number }> {
      const { data, error } = await client.rpc("admin_list_audit_events", {
        p_actor_id: actorId,
        p_filter_actor: query.actor ?? null,
        p_action: query.action ?? null,
        p_entity_type: query.entity_type ?? null,
        p_entity_id: query.entity_id ?? null,
        p_semester_id: query.semester_id ?? null,
        p_from: query.from ?? null,
        p_to: query.to ?? null,
        p_limit: limit,
        p_offset: offset,
      });
      if (error) throw error;
      const list = asRows(data);
      return {
        rows: list.map(toRow),
        total: Number(list[0]?.total_count ?? 0),
      };
    },

    async get(actorId: string, eventId: string): Promise<AuditEventRow | null> {
      const { data, error } = await client.rpc("admin_get_audit_event", {
        p_actor_id: actorId,
        p_event_id: eventId,
      });
      if (error) throw error;
      const row = asRows(data)[0];
      return row ? toRow(row) : null;
    },

    async filterValues(actorId: string): Promise<AuditFilterValues> {
      const { data, error } = await client.rpc("admin_audit_filter_values", {
        p_actor_id: actorId,
      });
      if (error) throw error;
      const value = (data ?? {}) as {
        actions?: string[];
        entity_types?: string[];
      };
      return {
        actions: value.actions ?? [],
        entity_types: value.entity_types ?? [],
      };
    },

    async purgeExpired(
      retentionDays: number,
      batch: number,
      requestId: string,
    ): Promise<number> {
      const { data, error } = await client.rpc("audit_purge_expired", {
        p_older_than: `${retentionDays} days`,
        p_limit: batch,
        p_request_id: requestId,
      });
      if (error) throw error;
      return Number(data);
    },
  };
}
export type AuditRepository = ReturnType<typeof createAuditRepository>;
