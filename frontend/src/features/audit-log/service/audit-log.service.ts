// Reads audit events from the backend (GET /api/admin/audit-events). Server-only: it goes
// through backendFetch, which attaches the admin session token from the httpOnly cookie.
import { backendFetch } from "@/shared/api/backend";
import type {
  AuditEvent,
  AuditFilterOptions,
  AuditFilters,
  AuditListPage,
  FieldChange,
} from "@/features/audit-log/models/audit-event";

export const PAGE_SIZE = 25;

/** AuditEvent in backend/src/modules/audit/model/audit.model.ts. */
interface AuditEventDto {
  id: string;
  actor: { id: string; email: string | null; full_name: string | null } | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  semester_id: string | null;
  metadata: Record<string, unknown>;
  request_id: string | null;
  occurred_at: string;
  diff: FieldChange[];
}

function mapEvent(dto: AuditEventDto): AuditEvent {
  return {
    id: dto.id,
    actor: dto.actor && {
      id: dto.actor.id,
      email: dto.actor.email,
      fullName: dto.actor.full_name,
    },
    action: dto.action,
    entityType: dto.entity_type,
    entityId: dto.entity_id,
    semesterId: dto.semester_id,
    metadata: dto.metadata,
    requestId: dto.request_id,
    occurredAt: dto.occurred_at,
    diff: dto.diff,
  };
}

export async function getAuditEvents(filters: AuditFilters): Promise<AuditListPage> {
  const params = new URLSearchParams({ page: String(filters.page), size: String(PAGE_SIZE) });
  if (filters.action) params.set("action", filters.action);
  if (filters.entityType) params.set("entity_type", filters.entityType);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const data = await backendFetch<{
    items: AuditEventDto[];
    page: number;
    size: number;
    total: number;
  }>(`/api/admin/audit-events?${params}`);
  return { events: data.items.map(mapEvent), page: data.page, size: data.size, total: data.total };
}

export async function getAuditFilterOptions(): Promise<AuditFilterOptions> {
  const data = await backendFetch<{ actions: string[]; entity_types: string[] }>(
    "/api/admin/audit-events/filters",
  );
  return { actions: data.actions, entityTypes: data.entity_types };
}
