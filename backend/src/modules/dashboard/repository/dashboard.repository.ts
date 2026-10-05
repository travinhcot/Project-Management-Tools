import type { SupabaseClient } from "@supabase/supabase-js";
import type { RawSummary, TrendRow } from "../model/dashboard.model.ts";

const TREND_NUMBERS = [
  "roster_total",
  "roster_active",
  "accounts_linked",
  "members_assigned",
  "projects",
  "campaigns",
  "deliveries_total",
  "deliveries_sent",
  "deliveries_failed",
] as const;

export function createDashboardRepository(client: SupabaseClient) {
  return {
    /** One round trip: counts, upcoming campaigns and warning lists. */
    async summary(actorId: string, itemLimit: number): Promise<RawSummary> {
      const { data, error } = await client.rpc("admin_dashboard_summary", {
        p_actor_id: actorId,
        p_item_limit: itemLimit,
      });
      if (error) throw error;
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw new TypeError("Unexpected database response.");
      return data as RawSummary;
    },

    async trends(actorId: string, limit: number): Promise<TrendRow[]> {
      const { data, error } = await client.rpc("admin_dashboard_trends", {
        p_actor_id: actorId,
        p_limit: limit,
      });
      if (error) throw error;
      if (!Array.isArray(data)) throw new TypeError("Unexpected database response.");
      return data.map((row: Record<string, unknown>) => {
        const numbers = Object.fromEntries(
          TREND_NUMBERS.map((key) => [key, Number(row[key] ?? 0)]),
        ) as Pick<TrendRow, (typeof TREND_NUMBERS)[number]>;
        return {
          semester_id: String(row.semester_id),
          semester_name: String(row.semester_name),
          is_current: row.is_current === true,
          ...numbers,
        };
      });
    },
  };
}
export type DashboardRepository = ReturnType<typeof createDashboardRepository>;
