import type { SupabaseClient } from "@supabase/supabase-js";

import { createRosterImportRepository } from "../repository/roster-import.repository.ts";
import { createRosterImportService } from "../service/roster-import.service.ts";
import { createRosterAdminRouter } from "../routes/roster-admin.routes.ts";

/** Public roster-module entry point (CSV imports). Only composition roots import this file. */
export function createRosterInterface(databaseClient: SupabaseClient) {
  const imports = createRosterImportService(createRosterImportRepository(databaseClient));
  return {
    adminRouter: createRosterAdminRouter(imports),
  };
}

export type RosterInterface = ReturnType<typeof createRosterInterface>;
