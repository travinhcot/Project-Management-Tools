import type { SupabaseClient } from "@supabase/supabase-js";
export type { UsersService, ProfileIdentity, VerifiedProfileIdentity } from "../service/user.service.ts";

export type { AppUser, UserRole } from '../model/user.model.ts';

import { createUserRepository } from "../repository/user.repository.ts";
import { createUserService } from "../service/user.service.ts";

/** Public users-module entry point. Auth must not import users internals. */
export function createUsersInterface(databaseClient: SupabaseClient) {
  return createUserService(createUserRepository(databaseClient));
}
