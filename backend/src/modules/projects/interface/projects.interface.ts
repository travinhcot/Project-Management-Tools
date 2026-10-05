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
import { createProjectMemberRepository } from "../repository/project-member.repository.ts";
import { createProjectMemberService } from "../service/project-member.service.ts";
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
  const memberService = createProjectMemberService(
    createProjectMemberRepository(databaseClient),
    dependencies.roster,
  );
  return { adminRouter: createProjectAdminRouter(service, memberService) };
}

export type ProjectsInterface = ReturnType<typeof createProjectsInterface>;
