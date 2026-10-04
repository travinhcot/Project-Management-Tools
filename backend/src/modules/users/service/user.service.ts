import type {
  AppUser,
  UserRole,
  AdminUserView,
  AdminUserListQuery,
  AdminUserAccessUpdate,
  Page,
} from "../model/user.model.ts";
import type { UserRepository } from "../repository/user.repository.ts";

export interface ProfileIdentity {
  readonly id: string;
  readonly email: string;
}
export interface VerifiedProfileIdentity extends ProfileIdentity {
  readonly email_verified_at: string;
}

import { HttpError } from "../../../shared/http-error.ts";

function accessError(error: unknown): HttpError {
  const code =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  const message =
    error && typeof error === "object" && "message" in error
      ? error.message
      : undefined;
  if (code === "22023")
    return new HttpError(
      400,
      "INVALID_INPUT",
      "Provide a valid role or is_active.",
    );
  if (code === "42501")
    return new HttpError(
      403,
      "FORBIDDEN",
      "You do not have permission for this action.",
    );
  if (code === "P0002")
    return new HttpError(404, "USER_NOT_FOUND", "User not found.");
  if (code === "P0001" && message === "LAST_ADMIN") {
    return new HttpError(
      409,
      "LAST_ADMIN",
      "At least one active admin must remain.",
    );
  }
  return new HttpError(
    503,
    "USERS_UNAVAILABLE",
    "User management is temporarily unavailable.",
  );
}

export function createUserService(repository: UserRepository) {
  async function getActiveProfile(identity: ProfileIdentity): Promise<AppUser> {
    let profile: AppUser | null;
    try {
      profile = await repository.findById(identity.id);
    } catch {
      throw new HttpError(
        503,
        "PROFILE_UNAVAILABLE",
        "User profiles are temporarily unavailable.",
      );
    }
    if (!profile || !profile.is_active) {
      throw new HttpError(
        403,
        "ACCOUNT_UNAVAILABLE",
        "This account is not provisioned or is inactive.",
      );
    }
    if (
      !["ADMIN", "MEMBER"].includes(profile.role) ||
      profile.normalized_email !== identity.email.trim().toLowerCase()
    ) {
      throw new HttpError(
        403,
        "PROFILE_MISMATCH",
        "The account profile requires administrator attention.",
      );
    }
    return profile;
  }

  return {
    getActiveProfile,
    // Trusted bootstrap only. No HTTP route exposes role provisioning.
    async provisionVerifiedProfile(
      identity: VerifiedProfileIdentity,
      fullName: string,
      role: UserRole = "MEMBER",
    ) {
      if (
        !identity?.id ||
        !identity.email ||
        !identity.email_verified_at ||
        !["ADMIN", "MEMBER"].includes(role) ||
        typeof fullName !== "string" ||
        !fullName.trim() ||
        [...fullName.trim()].length > 200
      ) {
        throw new HttpError(
          400,
          "INVALID_PROFILE",
          "A verified identity, name and valid role are required.",
        );
      }
      try {
        return await repository.createProfile({
          id: identity.id,
          email: identity.email,
          full_name: fullName.trim(),
          role,
        });
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "23505"
        ) {
          throw new HttpError(
            409,
            "PROFILE_EXISTS",
            "A profile already exists for this identity or email.",
          );
        }
        throw new HttpError(
          503,
          "PROVISIONING_FAILED",
          "Profile provisioning failed; check database and migration setup.",
        );
      }
    },
    async listUsers(query: AdminUserListQuery): Promise<Page<AdminUserView>> {
      try {
        const { rows, total } = await repository.listForAdmin(query);
        return { items: rows, page: query.page, size: query.size, total };
      } catch {
        throw new HttpError(
          503,
          "USERS_UNAVAILABLE",
          "User management is temporarily unavailable.",
        );
      }
    },
    async changeAccess(
      actorId: string,
      targetId: string,
      change: AdminUserAccessUpdate,
      requestId: string,
    ): Promise<AppUser> {
      try {
        return await repository.updateAccess({
          actorId,
          targetId,
          change,
          requestId,
        });
      } catch (error) {
        throw accessError(error);
      }
    },
    async updateOwnProfile(identity: ProfileIdentity, fullName: string) {
      await getActiveProfile(identity);
      let profile;
      try {
        profile = await repository.updateName(identity.id, fullName);
      } catch {
        throw new HttpError(
          503,
          "PROFILE_UNAVAILABLE",
          "User profiles are temporarily unavailable.",
        );
      }
      if (!profile)
        throw new HttpError(
          403,
          "ACCOUNT_UNAVAILABLE",
          "This account is inactive.",
        );
      return profile;
    },
  };
}

export type UsersService = ReturnType<typeof createUserService>;
