/** Maximum rows in one CSV export. */
export const EXPORT_LIMIT = 10_000;
/** D-11 default: keep audit rows for two years. */
export const DEFAULT_RETENTION_DAYS = 730;
/** Rows deleted per retention call; the scheduler calls again while more remain. */
export const RETENTION_BATCH = 5_000;

export interface AuditEventRow {
  readonly id: string;
  readonly actor_user_id: string | null;
  readonly actor_email: string | null;
  readonly actor_name: string | null;
  readonly action: string;
  readonly entity_type: string;
  readonly entity_id: string | null;
  readonly semester_id: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly request_id: string | null;
  readonly occurred_at: string;
}

export interface FieldChange {
  readonly field: string;
  readonly before: unknown;
  readonly after: unknown;
}

export interface AuditEvent
  extends Omit<AuditEventRow, "actor_user_id" | "actor_email" | "actor_name"> {
  readonly actor: {
    readonly id: string;
    readonly email: string | null;
    readonly full_name: string | null;
  } | null;
  /** Changed fields, derived from metadata.before / metadata.after. Empty when the event has none. */
  readonly diff: readonly FieldChange[];
}

export interface AuditListQuery {
  readonly actor?: string;
  readonly action?: string;
  readonly entity_type?: string;
  readonly entity_id?: string;
  readonly semester_id?: string;
  /** Inclusive start / exclusive end instants (day boundaries are in Asia/Ho_Chi_Minh, SR-6). */
  readonly from?: string;
  readonly to?: string;
  readonly page: number;
  readonly size: number;
}

export interface AuditFilterValues {
  readonly actions: readonly string[];
  readonly entity_types: readonly string[];
}

/** What a caller (another module, through a port wired in server.ts) may record. */
export interface AuditRecordInput {
  readonly actorId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId?: string | null;
  readonly semesterId?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly requestId: string;
}

export interface AuditOptions {
  readonly internalSecret?: string;
  readonly retentionDays?: number;
}
