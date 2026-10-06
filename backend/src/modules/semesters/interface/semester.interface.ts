import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ProjectStatsGateway,
  RosterStatsGateway,
} from "../model/semester.model.ts";

export type {
  Semester,
  SemesterTerm,
  RosterStatsGateway,
  ProjectStatsGateway,
} from "../model/semester.model.ts";

import { createSemesterRepository } from "../repository/semester.repository.ts";
import { createSemesterService } from "../service/semester.service.ts";
import { createSemesterAdminRouter } from "../routes/semester-admin.routes.ts";

/** Public semesters-module entry point. Only composition roots import this file. */
export function createSemestersInterface(
  databaseClient: SupabaseClient,
  dependencies: {
    rosterStats: RosterStatsGateway;
    projectStats: ProjectStatsGateway;
  },
) {
  const service = createSemesterService(
    createSemesterRepository(databaseClient),
    dependencies.rosterStats,
    dependencies.projectStats,
  );
  return {
    /** What other modules may ask of semesters, handed to them as a port in server.ts. */
    service: {
      findCurrent: () => service.findCurrent(),
      findById: (id: string) => service.findById(id),
    },
    adminRouter: createSemesterAdminRouter(service),
  };
}

export type SemestersInterface = ReturnType<typeof createSemestersInterface>;
