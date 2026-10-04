import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppUser,
  UserRole,
  AdminUserView,
  AdminUserListQuery,
  AdminUserAccessUpdate,
} from "../model/user.model.ts";

const columns =
  "id,email,normalized_email,full_name,role,is_active,created_at,updated_at";

export function createUserRepository(client: SupabaseClient) {
  return {
    async createProfile(input: {
      id: string;
      email: string;
      full_name: string;
      role: UserRole;
    }): Promise<AppUser> {
      const { data, error } = await client
        .from("app_users")
        .insert(input)
        .select(columns)
        .single();
      if (error) throw error;
      return data;
    },
    async findById(id: string): Promise<AppUser | null> {
      const { data, error } = await client
        .from("app_users")
        .select(columns)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async listForAdmin(
      query: AdminUserListQuery,
    ): Promise<{ rows: AdminUserView[]; total: number }> {
      const { data, error } = await client.rpc("admin_list_users", {
        p_search: query.search ?? null,
        p_role: query.role ?? null,
        p_is_active: query.is_active ?? null,
        p_limit: query.size,
        p_offset: (query.page - 1) * query.size,
      });
      if (error) throw error;
      const rows = (data ?? []) as (AdminUserView & { total_count: number })[];
      return {
        rows: rows.map(({ total_count: _total, ...user }) => user),
        total: rows[0]?.total_count ?? 0,
      };
    },
    async updateAccess(input: {
      actorId: string;
      targetId: string;
      change: AdminUserAccessUpdate;
      requestId: string;
    }): Promise<AppUser> {
      const { data, error } = await client.rpc("admin_update_user_access", {
        p_actor_id: input.actorId,
        p_target_id: input.targetId,
        p_role: input.change.role ?? null,
        p_is_active: input.change.is_active ?? null,
        p_request_id: input.requestId,
      });
      if (error) throw error;
      return data as AppUser;
    },
    async updateName(id: string, fullName: string): Promise<AppUser | null> {
      const { data, error } = await client
        .from("app_users")
        .update({ full_name: fullName })
        .eq("id", id)
        .eq("is_active", true)
        .select(columns)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
