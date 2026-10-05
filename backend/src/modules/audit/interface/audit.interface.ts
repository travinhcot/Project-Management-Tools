import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditOptions } from "../model/audit.model.ts";

export type { AuditRecordInput, AuditOptions } from "../model/audit.model.ts";

import { createAuditRepository } from "../repository/audit.repository.ts";
import { createAuditService } from "../service/audit.service.ts";
import { createAuditAdminRouter } from "../routes/audit-admin.routes.ts";
import { createAuditInternalRouter } from "../routes/audit-internal.routes.ts";

/** Public audit-module entry point. Only composition roots import this file. */
export function createAuditInterface(
  databaseClient: SupabaseClient,
  options: AuditOptions = {},
) {
  const service = createAuditService(createAuditRepository(databaseClient), {
    retentionDays: options.retentionDays,
  });
  return {
    /** What other modules may ask of audit, handed to them as a port in server.ts. */
    recorder: { record: service.record },
    adminRouter: createAuditAdminRouter(service),
    internalRouter: createAuditInternalRouter(service, options.internalSecret),
  };
}

export type AuditInterface = ReturnType<typeof createAuditInterface>;
