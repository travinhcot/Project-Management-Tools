/** Items listed per warning / upcoming list. The count is always the full number. */
export const ITEM_LIMIT = 10;
export const DEFAULT_TREND_SEMESTERS = 6;
export const MAX_TREND_SEMESTERS = 12;

export type WarningCode =
  | "PROJECTS_WITHOUT_MEMBERS"
  | "PROJECTS_MISSING_RESOURCES"
  | "CAMPAIGNS_WITH_FAILURES"
  | "IMPORTS_EXPIRED_UNUSED"
  | "OLD_SEMESTER_CAMPAIGNS_SCHEDULED";

export type Severity = "info" | "warning" | "error";

/** Shapes the summary function returns (snake_case jsonb). */
export interface RawItem {
  readonly id: string;
  readonly name: string;
  readonly [extra: string]: unknown;
}

export interface RawWarning {
  readonly count: number;
  readonly items: readonly RawItem[];
}

export interface RawSummary {
  readonly semester: { readonly id: string; readonly name: string } | null;
  readonly roster_active?: number;
  readonly projects?: { readonly software: number; readonly hardware: number };
  readonly upcoming_campaigns?: readonly (RawItem & {
    readonly kind: "KICKOFF" | "DEMO";
    readonly project_id: string | null;
    readonly scheduled_at: string;
    readonly overdue: boolean;
  })[];
  readonly deliveries?: { readonly failed: number; readonly unknown: number };
  readonly projects_without_members?: RawWarning;
  readonly projects_missing_resources?: RawWarning;
  readonly campaigns_with_failures?: RawWarning;
  readonly imports_expired_unused?: RawWarning;
  readonly old_semester_scheduled?: RawWarning;
}

export interface Warning {
  readonly code: WarningCode;
  readonly severity: Severity;
  readonly message: string;
  readonly count: number;
  readonly link: string;
  readonly items: readonly (RawItem & { readonly link: string })[];
}

export interface Dashboard {
  readonly semester: { readonly id: string; readonly name: string } | null;
  /** True when no semester is current: show the empty state. */
  readonly empty: boolean;
  readonly metrics: {
    readonly roster: { readonly active: number; readonly link: string };
    readonly projects: {
      readonly software: number;
      readonly hardware: number;
      readonly total: number;
      readonly link: string;
    };
    readonly upcoming_campaigns: {
      readonly count: number;
      readonly items: readonly (RawItem & { readonly link: string })[];
      readonly link: string;
    };
    readonly failed_deliveries: {
      readonly failed: number;
      readonly unknown: number;
      readonly link: string;
    };
  } | null;
  readonly warnings: readonly Warning[];
}

export interface TrendRow {
  readonly semester_id: string;
  readonly semester_name: string;
  readonly is_current: boolean;
  readonly roster_total: number;
  readonly roster_active: number;
  readonly accounts_linked: number;
  readonly members_assigned: number;
  readonly projects: number;
  readonly campaigns: number;
  readonly deliveries_total: number;
  readonly deliveries_sent: number;
  readonly deliveries_failed: number;
}

export interface SemesterTrend extends TrendRow {
  /** Percentages 0–100 with one decimal; null when there is nothing to divide by. */
  readonly assignment_coverage_pct: number | null;
  readonly account_linked_pct: number | null;
  readonly delivery_success_pct: number | null;
  readonly delivery_failure_pct: number | null;
}
