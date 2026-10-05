import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RosterListQuery,
  RosterMember,
  RosterMemberChanges,
  RosterMemberCreate,
} from "../model/roster-member.model.ts";

export function createRosterMemberRepository(client: SupabaseClient) {
  return {
    async list(query: RosterListQuery): Promise<{ rows: RosterMember[]; total: number }> {
      const { data, error } = await client.rpc("admin_list_roster", {
        p_semester_id: query.semesterId,
        p_search: query.search ?? null,
        p_status: query.status ?? null,
        p_linked: query.linked ?? null,
        p_limit: query.size,
        p_offset: (query.page - 1) * query.size,
      });
      if (error) throw error;
      const rows = (data ?? []) as (RosterMember & { total_count: number })[];
      return {
        rows: rows.map(({ total_count: _total, ...member }) => member),
        total: rows[0]?.total_count ?? 0,
      };
    },

    async add(input: {
      actorId: string;
      semesterId: string;
      member: RosterMemberCreate;
      requestId: string;
    }): Promise<RosterMember> {
      const { data, error } = await client.rpc("admin_add_roster_member", {
        p_actor_id: input.actorId,
        p_semester_id: input.semesterId,
        p_email: input.member.email,
        p_full_name: input.member.full_name,
        p_other_info: input.member.other_info,
        p_request_id: input.requestId,
      });
      if (error) throw error;
      return data as RosterMember;
    },

    async update(input: {
      actorId: string;
      rosterMemberId: string;
      changes: RosterMemberChanges;
      requestId: string;
    }): Promise<RosterMember> {
      const { data, error } = await client.rpc("admin_update_roster_member", {
        p_actor_id: input.actorId,
        p_roster_member_id: input.rosterMemberId,
        p_changes: input.changes,
        p_request_id: input.requestId,
      });
      if (error) throw error;
      return data as RosterMember;
    },

    async countActive(semesterId: string): Promise<number> {
      const { count, error } = await client
        .from("roster_members")
        .select("id", { count: "exact", head: true })
        .eq("semester_id", semesterId)
        .eq("status", "ACTIVE");
      if (error) throw error;
      return count ?? 0;
    },
  };
}

export type RosterMemberRepository = ReturnType<typeof createRosterMemberRepository>;
