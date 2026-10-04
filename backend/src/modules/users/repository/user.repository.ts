import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppUser, UserRole } from "../model/user.model.ts";

const columns =
  "id,email,normalized_email,full_name,role,is_active,created_at,updated_at";

export function createUserRepository(client: SupabaseClient) {
  return {
    async createProfile(input: { id: string; email: string; full_name: string; role: UserRole }): Promise<AppUser> {
      const { data, error } = await client.from("app_users").insert(input).select(columns).single();
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
