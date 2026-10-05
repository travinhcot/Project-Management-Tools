import type { SupabaseClient } from "@supabase/supabase-js";

import { createDashboardRepository } from "../repository/dashboard.repository.ts";
import { createDashboardService } from "../service/dashboard.service.ts";
import { createDashboardAdminRouter } from "../routes/dashboard-admin.routes.ts";

/** Public dashboard-module entry point. Only composition roots import this file. */
export function createDashboardInterface(databaseClient: SupabaseClient) {
  const service = createDashboardService(
    createDashboardRepository(databaseClient),
  );
  return { adminRouter: createDashboardAdminRouter(service) };
}

export type DashboardInterface = ReturnType<typeof createDashboardInterface>;
