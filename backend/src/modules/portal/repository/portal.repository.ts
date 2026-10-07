import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Eligibility,
  MemberRole,
  PortalProfileRow,
  PortalProjectSummary,
  PortalSemesterRow,
  PortalTeammate,
  ProjectStatus,
  PortalProjectRow,
  ProjectType,
} from "../model/portal.model.ts";

function asRows(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data))
    throw new TypeError("Unexpected database response.");
  return data.map((row) => {
    if (!row || typeof row !== "object")
      throw new TypeError("Unexpected database response.");
    return row as Record<string, unknown>;
  });
}

function toProject(row: Record<string, unknown>): PortalProjectRow {
  return {
    id: String(row.id),
    name: String(row.name),
    type: row.type as ProjectType,
    description: (row.description as string | null) ?? null,
    semester_id: String(row.semester_id),
    semester_name: String(row.semester_name),
    is_current: row.is_current === true,
    status: row.status as ProjectStatus,
    kickoff_at: (row.kickoff_at as string | null) ?? null,
  };
}

export function createPortalRepository(client: SupabaseClient) {
  return {
    async eligibility(actorId: string): Promise<Eligibility> {
      const { data, error } = await client.rpc("member_eligibility", {
        p_actor_id: actorId,
      });
      if (error) throw error;
      const row = asRows(data)[0];
      return row
        ? { eligible: true, semester_id: String(row.semester_id) }
        : { eligible: false, semester_id: null };
    },

    /** One query for the whole list. */
    async listProjects(
      actorId: string,
      includePast: boolean,
    ): Promise<PortalProjectRow[]> {
      const { data, error } = await client.rpc("member_list_projects", {
        p_actor_id: actorId,
        p_include_past: includePast,
      });
      if (error) throw error;
      return asRows(data).map(toProject);
    },

    /** null for unknown and unauthorized alike. */
    async getProject(
      actorId: string,
      projectId: string,
      includePast: boolean,
    ): Promise<PortalProjectRow | null> {
      const { data, error } = await client.rpc("member_get_project", {
        p_actor_id: actorId,
        p_project_id: projectId,
        p_include_past: includePast,
      });
      if (error) throw error;
      const row = asRows(data)[0];
      return row ? toProject(row) : null;
    },

    async teammates(
      actorId: string,
      projectId: string,
      includePast: boolean,
    ): Promise<PortalTeammate[]> {
      const { data, error } = await client.rpc("member_project_teammates", {
        p_actor_id: actorId,
        p_project_id: projectId,
        p_include_past: includePast,
      });
      if (error) throw error;
      return asRows(data).map((row) => ({
        full_name: String(row.full_name),
        role: row.role as MemberRole,
      }));
    },

    async summaries(
      actorId: string,
      includePast: boolean,
    ): Promise<Map<string, PortalProjectSummary>> {
      const { data, error } = await client.rpc("member_project_summaries", {
        p_actor_id: actorId,
        p_include_past: includePast,
      });
      if (error) throw error;
      return new Map(
        asRows(data).map((row) => [
          String(row.project_id),
          {
            leader_name: (row.leader_name as string | null) ?? null,
            member_count: Number(row.member_count),
          },
        ]),
      );
    },

    async profile(actorId: string): Promise<PortalProfileRow | null> {
      const { data, error } = await client.rpc("member_profile", {
        p_actor_id: actorId,
      });
      if (error) throw error;
      const row = asRows(data)[0];
      if (!row) return null;
      return {
        full_name: String(row.full_name),
        email: String(row.email),
        department: (row.department as string | null) ?? null,
      };
    },

    async semesters(actorId: string): Promise<PortalSemesterRow[]> {
      const { data, error } = await client.rpc("member_semesters", {
        p_actor_id: actorId,
      });
      if (error) throw error;
      return asRows(data).map((row) => ({
        semester_id: String(row.semester_id),
        name: String(row.name),
        is_current: row.is_current === true,
        ends_on: (row.ends_on as string | null) ?? null,
        project_count: Number(row.project_count),
      }));
    },

    async recentResourceCount(actorId: string, since: Date): Promise<number> {
      const { data, error } = await client.rpc("member_recent_resource_count", {
        p_actor_id: actorId,
        p_since: since.toISOString(),
      });
      if (error) throw error;
      return Number(data);
    },
  };
}
export type PortalRepository = ReturnType<typeof createPortalRepository>;
