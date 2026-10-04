import type { SupabaseClient } from "@supabase/supabase-js";
export type {
  UsersService,
  ProfileIdentity,
  VerifiedProfileIdentity,
} from "../service/user.service.ts";
export type {
  AppUser,
  UserRole,
  AdminUserView,
  Page,
} from "../model/user.model.ts";

import { createUserRepository } from "../repository/user.repository.ts";
import { createUserService } from "../service/user.service.ts";
import { createUserAdminRouter } from "../routes/user-admin.routes.ts";

/** Public users-module entry point. Only composition roots import this file. */
export function createUsersInterface(databaseClient: SupabaseClient) {
  const service = createUserService(createUserRepository(databaseClient));
  return { service, adminRouter: createUserAdminRouter(service) };
}

export type UsersInterface = ReturnType<typeof createUsersInterface>;
