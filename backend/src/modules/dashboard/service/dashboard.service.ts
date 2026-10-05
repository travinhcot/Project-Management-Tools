import type { DashboardRepository } from "../repository/dashboard.repository.ts";
import type {
  Dashboard,
  RawSummary,
  RawWarning,
  SemesterTrend,
  TrendRow,
  Warning,
  WarningCode,
} from "../model/dashboard.model.ts";

import { dashboardError } from "../common/dashboard-errors.ts";
import {
  campaignLink,
  LINKS,
  WARNING_META,
} from "../common/dashboard-links.ts";
import { ITEM_LIMIT } from "../model/dashboard.model.ts";

function warning(code: WarningCode, raw: RawWarning | undefined): Warning[] {
  if (!raw || raw.count < 1) return [];
  const meta = WARNING_META[code];
  return [
    {
      code,
      severity: meta.severity,
      message: meta.message,
      count: Number(raw.count),
      link: meta.link,
      items: raw.items.map((item) => ({
        ...item,
        link: meta.itemLink(item.id),
      })),
    },
  ];
}

export function shapeDashboard(raw: RawSummary): Dashboard {
  const warnings = [
    ...warning("CAMPAIGNS_WITH_FAILURES", raw.campaigns_with_failures),
    ...warning("OLD_SEMESTER_CAMPAIGNS_SCHEDULED", raw.old_semester_scheduled),
    ...warning("PROJECTS_WITHOUT_MEMBERS", raw.projects_without_members),
    ...warning("PROJECTS_MISSING_RESOURCES", raw.projects_missing_resources),
    ...warning("IMPORTS_EXPIRED_UNUSED", raw.imports_expired_unused),
  ];
  if (!raw.semester)
    return { semester: null, empty: true, metrics: null, warnings };

  const software = Number(raw.projects?.software ?? 0);
  const hardware = Number(raw.projects?.hardware ?? 0);
  const upcoming = raw.upcoming_campaigns ?? [];
  return {
    semester: raw.semester,
    empty: false,
    metrics: {
      roster: { active: Number(raw.roster_active ?? 0), link: LINKS.roster },
      projects: {
        software,
        hardware,
        total: software + hardware,
        link: LINKS.projects,
      },
      upcoming_campaigns: {
        count: upcoming.length,
        items: upcoming.map((item) => ({
          ...item,
          link: campaignLink(item.id),
        })),
        link: LINKS.campaigns,
      },
      failed_deliveries: {
        failed: Number(raw.deliveries?.failed ?? 0),
        unknown: Number(raw.deliveries?.unknown ?? 0),
        link: LINKS.failedCampaigns,
      },
    },
    warnings,
  };
}

function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

export function shapeTrend(row: TrendRow): SemesterTrend {
  return {
    ...row,
    assignment_coverage_pct: pct(row.members_assigned, row.roster_active),
    account_linked_pct: pct(row.accounts_linked, row.roster_active),
    delivery_success_pct: pct(row.deliveries_sent, row.deliveries_total),
    delivery_failure_pct: pct(row.deliveries_failed, row.deliveries_total),
  };
}

export function createDashboardService(repository: DashboardRepository) {
  return {
    async summary(actorId: string): Promise<Dashboard> {
      try {
        return shapeDashboard(await repository.summary(actorId, ITEM_LIMIT));
      } catch (error) {
        throw dashboardError(error);
      }
    },

    /** Oldest semester first, ready for a chart axis. */
    async trends(actorId: string, semesters: number): Promise<SemesterTrend[]> {
      try {
        const rows = await repository.trends(actorId, semesters);
        return rows.map(shapeTrend).reverse();
      } catch (error) {
        throw dashboardError(error);
      }
    },
  };
}

export type DashboardService = ReturnType<typeof createDashboardService>;
