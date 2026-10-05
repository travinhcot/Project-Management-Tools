import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectDependencies } from "../model/project.model.ts";

export type {
  Project,
  SemesterLookup,
  RosterLookup,
  ResourceSummaryGateway,
  KickoffGateway,
} from "../model/project.model.ts";

import { createProjectRepository } from "../repository/project.repository.ts";
import { createProjectService } from "../service/project.service.ts";
import { createProjectAdminRouter } from "../routes/project-admin.routes.ts";

/** Public projects-module entry point. Only composition roots import this file. */
export function createProjectsInterface(
  databaseClient: SupabaseClient,
  dependencies: ProjectDependencies,
) {
  const service = createProjectService(
    createProjectRepository(databaseClient),
    dependencies,
  );
  return { adminRouter: createProjectAdminRouter(service) };
}

export type ProjectsInterface = ReturnType<typeof createProjectsInterface>;
