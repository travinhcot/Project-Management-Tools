import type { SupabaseClient } from "@supabase/supabase-js";

import { createDepartmentResourceRepository } from "../repository/department-resource.repository.ts";
import { createDepartmentStorageRepository } from "../repository/department-storage.repository.ts";
import { createDepartmentResourceService } from "../service/department-resource.service.ts";
import { createDepartmentResourceRouter } from "../routes/department-resource.routes.ts";
import { createDepartmentResourceInternalRouter } from "../routes/department-resource-internal.routes.ts";

export interface DepartmentResourcesOptions {
  /** Private Storage bucket (the same one as project files). */
  readonly bucketId: string;
  /** Shared secret for /api/internal/*. Unset disables those endpoints. */
  readonly internalSecret?: string;
}

/** Public department-resources entry point. Only composition roots import this file. */
export function createDepartmentResourcesInterface(
  databaseClient: SupabaseClient,
  options: DepartmentResourcesOptions,
) {
  const service = createDepartmentResourceService(
    createDepartmentResourceRepository(databaseClient),
    createDepartmentStorageRepository(databaseClient),
    options.bucketId,
  );
  return {
    router: createDepartmentResourceRouter(service),
    internalRouter: createDepartmentResourceInternalRouter(service, options.internalSecret),
  };
}
export type DepartmentResourcesInterface = ReturnType<typeof createDepartmentResourcesInterface>;
