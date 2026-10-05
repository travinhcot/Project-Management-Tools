import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Eligibility,
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
    ): Promise<string[]> {
      const { data, error } = await client.rpc("member_project_teammates", {
        p_actor_id: actorId,
        p_project_id: projectId,
        p_include_past: includePast,
      });
      if (error) throw error;
      return asRows(data).map((row) => String(row.full_name));
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
