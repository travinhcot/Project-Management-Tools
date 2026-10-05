import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssignOutcome,
  RemovedAssignment,
} from "../model/project-member.model.ts";

interface RemovedRow {
  id: string;
  roster_member_id: string;
  removed_at: string;
}

export function createProjectMemberRepository(client: SupabaseClient) {
  return {
    async assign(input: {
      actorId: string;
      projectId: string;
      rosterMemberIds: readonly string[];
      requestId: string;
    }): Promise<AssignOutcome> {
      const { data, error } = await client.rpc("admin_assign_project_members", {
        p_actor_id: input.actorId,
        p_project_id: input.projectId,
        p_roster_member_ids: input.rosterMemberIds,
        p_request_id: input.requestId,
      });
      if (error) throw error;
      return data as AssignOutcome;
    },

    async remove(input: {
      actorId: string;
      projectId: string;
      rosterMemberId: string;
      requestId: string;
    }): Promise<RemovedAssignment> {
      const { data, error } = await client.rpc("admin_remove_project_member", {
        p_actor_id: input.actorId,
        p_project_id: input.projectId,
        p_roster_member_id: input.rosterMemberId,
        p_request_id: input.requestId,
      });
      if (error) throw error;
      const row = data as RemovedRow;
      return {
        assignment_id: row.id,
        roster_member_id: row.roster_member_id,
        removed_at: row.removed_at,
      };
    },
  };
}

export type ProjectMemberRepository = ReturnType<
  typeof createProjectMemberRepository
>;
