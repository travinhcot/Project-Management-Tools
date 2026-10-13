import type { SupabaseClient } from "@supabase/supabase-js";
import type { DepartmentName, ProvisionCandidate } from "../model/roster-import.model.ts";

import { normalizeEmail } from "../../../shared/roster-rules.ts";

const columns = "id,email,full_name,department:departments(code)";
type Row = {
  id: string;
  email: string;
  full_name: string;
  department: { code: DepartmentName } | null;
};

const toCandidate = (row: Row): ProvisionCandidate => ({
  id: row.id,
  email: row.email,
  full_name: row.full_name,
  department: row.department?.code ?? null,
});

export function createRosterProvisionRepository(client: SupabaseClient) {
  return {
    /** ACTIVE entries written by this import that still have no account. */
    async listImported(importId: string): Promise<ProvisionCandidate[]> {
      const { data, error } = await client
        .from("roster_members")
        .select(columns)
        .eq("last_import_id", importId)
        .eq("status", "ACTIVE")
        .is("user_id", null)
        .order("id");
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).map(toCandidate);
    },

    async listUnlinked(semesterId: string): Promise<ProvisionCandidate[]> {
      const rows: ProvisionCandidate[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await client
          .from("roster_members")
          .select(columns)
          .eq("semester_id", semesterId)
          .eq("status", "ACTIVE")
          .is("user_id", null)
          .order("id")
          .range(from, from + 999);
        if (error) throw error;
        rows.push(...((data ?? []) as unknown as Row[]).map(toCandidate));
        if ((data ?? []).length < 1000) return rows;
      }
    },

    async profileId(email: string): Promise<string | null> {
      const { data, error } = await client
        .from("app_users")
        .select("id")
        .eq("normalized_email", email)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },

    /** Creates a confirmed Auth user, or returns the existing one's id (confirming it if needed). */
    async ensureAuthUser(email: string): Promise<string> {
      const created = await client.auth.admin.createUser({ email, email_confirm: true });
      if (created.data?.user) return created.data.user.id;
      for (let page = 1; ; page += 1) {
        const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        const found = data.users.find((user) => user.email && normalizeEmail(user.email) === email);
        if (found) {
          if (!found.email_confirmed_at) {
            const { error: confirmError } = await client.auth.admin.updateUserById(found.id, {
              email_confirm: true,
            });
            if (confirmError) throw confirmError;
          }
          return found.id;
        }
        if (data.users.length < 1000) throw created.error ?? new Error("Auth user was not created.");
      }
    },

    /** Links this person's roster entries in every semester (the database checks the emails match). */
    async link(email: string, userId: string): Promise<void> {
      const { error } = await client
        .from("roster_members")
        .update({ user_id: userId })
        .eq("normalized_email", email)
        .is("user_id", null);
      if (error) throw error;
    },
  };
}

export type RosterProvisionRepository = ReturnType<typeof createRosterProvisionRepository>;
