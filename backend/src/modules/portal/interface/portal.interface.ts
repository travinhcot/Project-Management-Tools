import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PortalDependencies,
  PortalOptions,
} from "../model/portal.model.ts";

export type {
  PortalDependencies,
  PortalOptions,
  ResourceGateway,
  ResourceRecord,
} from "../model/portal.model.ts";

import { createPortalRepository } from "../repository/portal.repository.ts";
import { createPortalService } from "../service/portal.service.ts";
import { createPortalMemberRouter } from "../routes/portal-member.routes.ts";

/** Public portal-module entry point. Only composition roots import this file. */
export function createPortalInterface(
  databaseClient: SupabaseClient,
  dependencies: PortalDependencies,
  options: PortalOptions = {},
) {
  const service = createPortalService(
    createPortalRepository(databaseClient),
    dependencies,
    options,
  );
  return { memberRouter: createPortalMemberRouter(service) };
}

export type PortalInterface = ReturnType<typeof createPortalInterface>;
