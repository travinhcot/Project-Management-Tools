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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asAssignOutcome(data: unknown): AssignOutcome {
  if (
    !isRecord(data) ||
    !Array.isArray(data.accepted) ||
    !Array.isArray(data.rejected)
  ) {
    throw new Error("admin_assign_project_members returned an unexpected shape");
  }
  return data as unknown as AssignOutcome;
}

function asRemovedRow(data: unknown): RemovedRow {
  if (
    !isRecord(data) ||
    typeof data.id !== "string" ||
    typeof data.roster_member_id !== "string" ||
    typeof data.removed_at !== "string"
  ) {
    throw new Error("admin_remove_project_member returned an unexpected shape");
  }
  return data as unknown as RemovedRow;
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
      return asAssignOutcome(data);
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
      const row = asRemovedRow(data);
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
