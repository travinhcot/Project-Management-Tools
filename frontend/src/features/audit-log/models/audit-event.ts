// Mirrors AuditEvent / AuditFilterValues in backend/src/modules/audit/model/audit.model.ts
// (snake_case there, camelCase here). Mapping lives in service/audit-log.service.ts.
export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface AuditEvent {
  id: string;
  /** Null for system events with no signed-in actor. */
  actor: { id: string; email: string | null; fullName: string | null } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  semesterId: string | null;
  metadata: Record<string, unknown>;
  requestId: string | null;
  /** ISO timestamp. */
  occurredAt: string;
  diff: FieldChange[];
}

export interface AuditListPage {
  events: AuditEvent[];
  page: number;
  size: number;
  total: number;
}

export interface AuditFilterOptions {
  actions: string[];
  entityTypes: string[];
}

/** Filters held in the URL so the list is server-rendered and shareable. */
export interface AuditFilters {
  action: string;
  entityType: string;
  /** YYYY-MM-DD, or "" for open-ended. */
  from: string;
  to: string;
  page: number;
}
