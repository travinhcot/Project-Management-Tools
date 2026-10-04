import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileGateway } from "../model/auth.model.ts";

export type { VerifiedAuthIdentity, AuthenticatedUser, ProfileGateway, AccountRole } from '../model/auth.model.ts';

import { createAuthRepository } from "../repository/auth.repository.ts";
import { createAuthService } from "../service/auth.service.ts";
import { createAuthMiddleware } from "../middleware/auth.middleware.ts";
import { createAuthRouter } from "../routes/auth.routes.ts";

/** Public entry point for auth wiring and protection of other modules' routes. */
export function createAuthInterface({ createAuthClient, adminClient, users }: { createAuthClient: () => SupabaseClient; adminClient: SupabaseClient; users: ProfileGateway }) {
  const service = createAuthService(
    createAuthRepository(createAuthClient, adminClient),
    users,
  );
  const middleware = createAuthMiddleware(service);
  return { router: createAuthRouter(service, middleware), ...middleware };
}

export type AuthInterface = ReturnType<typeof createAuthInterface>;
