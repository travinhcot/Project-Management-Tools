import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsersService } from "../../users/interface/user.interface.ts";

export type { VerifiedAuthIdentity, AuthenticatedUser } from '../model/auth.model.ts';

import { createAuthRepository } from "../repository/auth.repository.ts";
import { createAuthService } from "../service/auth.service.ts";
import { createAuthMiddleware } from "../middleware/auth.middleware.ts";
import { createAuthRouter } from "../routes/auth.routes.ts";

/** Public entry point for auth wiring and protection of other modules' routes. */
export function createAuthInterface({ createAuthClient, adminClient, users }: { createAuthClient: () => SupabaseClient; adminClient: SupabaseClient; users: UsersService }) {
  const service = createAuthService(
    createAuthRepository(createAuthClient, adminClient),
    users,
  );
  const middleware = createAuthMiddleware(service);
  return { router: createAuthRouter(service, middleware), ...middleware };
}

export type AuthInterface = ReturnType<typeof createAuthInterface>;
