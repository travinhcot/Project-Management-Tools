import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GithubDependencies,
  GithubOptions,
} from "../model/github.model.ts";

export type { GithubDependencies, GithubOptions } from "../model/github.model.ts";

import { createGithubProvider } from "../provider/github.provider.ts";
import { createGithubRepository } from "../repository/github.repository.ts";
import { createGithubService } from "../service/github.service.ts";
import {
  createGithubAdminRouter,
  createGithubInternalRouter,
  createGithubMemberRouter,
} from "../routes/github.routes.ts";

/** Public github-module entry point. Only composition roots import this file. */
export function createGithubInterface(
  databaseClient: SupabaseClient,
  dependencies: GithubDependencies,
  options: GithubOptions = {},
) {
  const service = createGithubService(
    createGithubRepository(databaseClient),
    createGithubProvider(options.token),
    dependencies,
    { staleMinutes: options.staleMinutes },
  );
  return {
    adminRouter: createGithubAdminRouter(service),
    memberRouter: createGithubMemberRouter(service),
    internalRouter: createGithubInternalRouter(service, options.internalSecret),
  };
}

export type GithubInterface = ReturnType<typeof createGithubInterface>;
