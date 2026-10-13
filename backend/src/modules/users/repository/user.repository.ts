import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppUser,
  UserRole,
  DepartmentCode,
  AdminUserView,
  AdminUserListQuery,
  AdminUserAccessUpdate,
} from "../model/user.model.ts";

const columns =
  "id,email,normalized_email,full_name,role,department_id,is_active,created_at,updated_at,department:departments(code)";

type AppUserRow = Omit<AppUser, "department_code"> & {
  department: { code: DepartmentCode } | null;
};

function toAppUser({ department, ...row }: AppUserRow): AppUser {
  return { ...row, department_code: department?.code ?? null };
}

export function createUserRepository(client: SupabaseClient) {
  return {
    async createProfile(input: {
      id: string;
      email: string;
      full_name: string;
      role: UserRole;
      department_code?: DepartmentCode;
    }): Promise<AppUser> {
      const { department_code, ...profile } = input;
      let department_id: string | null = null;
      if (department_code) {
        const { data: department, error: lookup } = await client
          .from("departments")
          .select("id")
          .eq("code", department_code)
          .single();
        if (lookup) throw lookup;
        department_id = department.id;
      }
      const { data, error } = await client
        .from("app_users")
        .insert({ ...profile, department_id })
        .select(columns)
        .single();
      if (error) throw error;
      return toAppUser(data as unknown as AppUserRow);
    },
    async findById(id: string): Promise<AppUser | null> {
      const { data, error } = await client
        .from("app_users")
        .select(columns)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? toAppUser(data as unknown as AppUserRow) : null;
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
        p_department_code: query.department ?? null,
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
        p_department_code: input.change.department_code ?? null,
      });
      if (error) throw error;
      // The RPC returns the bare row; re-read so the response carries the department code.
      const updated = await this.findById((data as { id: string }).id);
      if (!updated) throw new Error("Updated user not found.");
      return updated;
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
      return data ? toAppUser(data as unknown as AppUserRow) : null;
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
