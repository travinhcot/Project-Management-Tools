// Mirrors AdminUserView / Page in backend/src/modules/users/model/user.model.ts
// (snake_case there, camelCase here). Mapping lives in service/users.service.ts.
export const USER_ROLES = ["ADMIN", "MEMBER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  /** ISO timestamp; null when the user has never signed in. */
  lastSignInAt: string | null;
}

export interface UserListPage {
  users: AppUser[];
  page: number;
  size: number;
  total: number;
}

/** Filters held in the URL so the list is server-rendered and shareable. */
export interface UserFilters {
  search: string;
  role: UserRole | "all";
  status: "all" | "active" | "inactive";
  page: number;
}

export interface AccessChange {
  role?: UserRole;
  isActive?: boolean;
}
