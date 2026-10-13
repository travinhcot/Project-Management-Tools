import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditPort, ProfileProvisioner } from "../model/roster-import.model.ts";

export type { AuditPort, ProfileProvisioner } from "../model/roster-import.model.ts";

import { createRosterImportRepository } from "../repository/roster-import.repository.ts";
import { createRosterProvisionRepository } from "../repository/roster-provision.repository.ts";
import { createRosterImportService } from "../service/roster-import.service.ts";
import { createRosterProvisionService } from "../service/roster-provision.service.ts";
import { createRosterAdminRouter } from "../routes/roster-admin.routes.ts";

/** Public roster-module entry point (CSV imports). Only composition roots import this file. */
export function createRosterInterface(
  databaseClient: SupabaseClient,
  { profiles, audit }: { profiles: ProfileProvisioner; audit?: AuditPort },
) {
  const provisioning = createRosterProvisionService(
    createRosterProvisionRepository(databaseClient),
    profiles,
    audit,
  );
  const imports = createRosterImportService(
    createRosterImportRepository(databaseClient),
    provisioning,
  );
  return {
    adminRouter: createRosterAdminRouter(imports),
    /** Also used by the `provision:roster` script to repair older imports. */
    provisioning,
  };
}

export type RosterInterface = ReturnType<typeof createRosterInterface>;
