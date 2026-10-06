// Reads users from the backend (GET /api/admin/users). Server-only: it goes through
// backendFetch, which attaches the admin session token from the httpOnly cookie.
import { backendFetch } from "@/shared/api/backend";
import type {
  AppUser,
  UserFilters,
  UserListPage,
  UserRole,
} from "@/features/users-access/models/user";

export const PAGE_SIZE = 20;

/** AdminUserView in backend/src/modules/users/model/user.model.ts. */
interface UserDto {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  last_sign_in_at: string | null;
}

function mapUser(dto: UserDto): AppUser {
  return {
    id: dto.id,
    email: dto.email,
    fullName: dto.full_name,
    role: dto.role,
    isActive: dto.is_active,
    lastSignInAt: dto.last_sign_in_at,
  };
}

export async function getUsers(filters: UserFilters): Promise<UserListPage> {
  const params = new URLSearchParams({ page: String(filters.page), size: String(PAGE_SIZE) });
  if (filters.search) params.set("search", filters.search);
  if (filters.role !== "all") params.set("role", filters.role);
  if (filters.status !== "all") params.set("active", String(filters.status === "active"));
  const data = await backendFetch<{ items: UserDto[]; page: number; size: number; total: number }>(
    `/api/admin/users?${params}`,
  );
  return { users: data.items.map(mapUser), page: data.page, size: data.size, total: data.total };
}

/** The signed-in admin's id (GET /api/auth/me), so the page can guard self-changes. */
export async function getCurrentUserId(): Promise<string> {
  const { user } = await backendFetch<{ user: { id: string } }>("/api/auth/me");
  return user.id;
}
