import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditRecorder, ProfileGateway } from "../model/auth.model.ts";

export type { VerifiedAuthIdentity, AuthenticatedUser, ProfileGateway, AccountRole, AuditRecorder } from '../model/auth.model.ts';

import { createAuthRepository } from "../repository/auth.repository.ts";
import { createAuthService } from "../service/auth.service.ts";
import { createAuthMiddleware } from "../middleware/auth.middleware.ts";
import { createAuthRouter } from "../routes/auth.routes.ts";

/** Public entry point for auth wiring and protection of other modules' routes. */
export function createAuthInterface({ createAuthClient, adminClient, users, audit }: { createAuthClient: () => SupabaseClient; adminClient: SupabaseClient; users: ProfileGateway; audit?: AuditRecorder }) {
  const service = createAuthService(
    createAuthRepository(createAuthClient, adminClient),
    users,
    audit,
  );
  const middleware = createAuthMiddleware(service);
  return { router: createAuthRouter(service, middleware), ...middleware };
}

export type AuthInterface = ReturnType<typeof createAuthInterface>;
