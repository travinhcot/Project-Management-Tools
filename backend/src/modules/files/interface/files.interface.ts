import type { SupabaseClient } from "@supabase/supabase-js";

export type {
  ResourceSlot,
  ResourceSummary,
} from "../model/resource.model.ts";

import { createResourceRepository } from "../repository/resource.repository.ts";
import { createFileStorageRepository } from "../repository/file-storage.repository.ts";
import { createResourceService } from "../service/resource.service.ts";
import { createFileService } from "../service/file.service.ts";
import { createResourceAdminRouter } from "../routes/resource-admin.routes.ts";
import { createResourceMemberRouter } from "../routes/resource-member.routes.ts";
import { createFileInternalRouter } from "../routes/file-internal.routes.ts";

export interface FilesOptions {
  /** Private Storage bucket for project files. */
  readonly bucketId: string;
  /** Shared secret for /api/internal/*. Unset disables those endpoints. */
  readonly internalSecret?: string;
}

/** Public files-module entry point. Only composition roots import this file. */
export function createFilesInterface(
  databaseClient: SupabaseClient,
  options: FilesOptions,
) {
  const repository = createResourceRepository(databaseClient);
  const resources = createResourceService(repository);
  const files = createFileService(
    repository,
    createFileStorageRepository(databaseClient),
    options.bucketId,
  );
  return {
    adminRouter: createResourceAdminRouter(resources, files),
    memberRouter: createResourceMemberRouter(files),
    internalRouter: createFileInternalRouter(files, options.internalSecret),
    /** What other modules may call; matches the projects module's ResourceSummaryGateway. */
    service: { summarize: resources.summarize },
  };
}
export type FilesInterface = ReturnType<typeof createFilesInterface>;
