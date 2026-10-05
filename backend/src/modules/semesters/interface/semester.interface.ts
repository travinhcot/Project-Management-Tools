import type { SupabaseClient } from "@supabase/supabase-js";
import type { RosterStatsGateway } from "../model/semester.model.ts";

export type { Semester, SemesterTerm, RosterStatsGateway } from "../model/semester.model.ts";

import { createSemesterRepository } from "../repository/semester.repository.ts";
import { createSemesterService } from "../service/semester.service.ts";
import { createSemesterAdminRouter } from "../routes/semester-admin.routes.ts";

/** Public semesters-module entry point. Only composition roots import this file. */
export function createSemestersInterface(
  databaseClient: SupabaseClient,
  dependencies: { rosterStats: RosterStatsGateway },
) {
  const service = createSemesterService(
    createSemesterRepository(databaseClient),
    dependencies.rosterStats,
  );
  return { adminRouter: createSemesterAdminRouter(service) };
}

export type SemestersInterface = ReturnType<typeof createSemestersInterface>;
