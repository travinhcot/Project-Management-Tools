import type { UserRepository } from "../src/modules/users/repository/user.repository.ts";
import type { AuthRepository } from "../src/modules/auth/repository/auth.repository.ts";

async function unexpected(): Promise<never> {
  throw new Error("Unexpected mock operation.");
}

export function userRepository(overrides: Partial<UserRepository>): UserRepository {
  return { createProfile: unexpected, findById: unexpected, updateName: unexpected, ...overrides };
}

export function authRepository(overrides: Partial<AuthRepository>): AuthRepository {
  return { requestOtp: unexpected, verifyOtp: unexpected, refresh: unexpected,
    getUser: unexpected, logout: unexpected, ...overrides };
}
