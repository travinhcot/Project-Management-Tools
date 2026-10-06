import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Project,
  ProjectAssignment,
  ProjectChanges,
  ProjectCreate,
  ProjectListQuery,
  ProjectRow,
} from "../model/project.model.ts";

const columns =
  "id,semester_id,name,description,type,status,archived_at,created_by_user_id,created_at,updated_at";

/** The SQL functions return the whole row, including legacy columns; expose only Project. */
function toProject(row: Project): Project {
  return {
    id: row.id,
    semester_id: row.semester_id,
    name: row.name,
    description: row.description,
    type: row.type,
    status: row.status,
    archived_at: row.archived_at,
    created_by_user_id: row.created_by_user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createProjectRepository(client: SupabaseClient) {
  async function listPage(
    query: ProjectListQuery,
    semesterId: string,
    limit: number,
    offset: number,
  ) {
    const { data, error } = await client.rpc("admin_list_projects", {
      p_semester_id: semesterId,
      p_search: query.search ?? null,
      p_type: query.type ?? null,
      p_status: query.status ?? null,
      p_archived: query.archived,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) throw error;
    return (data ?? []) as (Project & {
      member_count: number | string;
      leader_roster_member_id: string | null;
      leader_name: string | null;
      total_count: number | string;
    })[];
  }

  return {
    async list(
      query: ProjectListQuery,
      semesterId: string,
    ): Promise<{ rows: ProjectRow[]; total: number }> {
      const rows = await listPage(
        query,
        semesterId,
        query.size,
        (query.page - 1) * query.size,
      );
      let total = Number(rows[0]?.total_count ?? 0);
      if (rows.length === 0 && query.page > 1) {
        // Past the last page the window count has no row to ride on; ask for the first row.
        const first = await listPage(query, semesterId, 1, 0);
        total = Number(first[0]?.total_count ?? 0);
      }
      return {
        rows: rows.map((row) => ({
          ...toProject(row),
          member_count: Number(row.member_count),
          leader: row.leader_roster_member_id
            ? {
                roster_member_id: row.leader_roster_member_id,
                full_name: row.leader_name ?? "",
              }
            : null,
        })),
        total,
      };
    },

    async findById(id: string): Promise<Project | null> {
      const { data, error } = await client
        .from("projects")
        .select(columns)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Project | null;
    },

    async activeAssignments(projectId: string): Promise<ProjectAssignment[]> {
      const { data, error } = await client
        .from("project_members")
        .select("id,roster_member_id,role,added_at")
        .eq("project_id", projectId)
        .is("removed_at", null)
        .order("added_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProjectAssignment[];
    },

    /** Non-archived projects of a semester (archived ones are hidden from members and the UI). */
    async countInSemester(semesterId: string): Promise<number> {
      const { count, error } = await client
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("semester_id", semesterId)
        .is("archived_at", null);
      if (error) throw error;
      return count ?? 0;
    },

    async countActiveAssignments(projectId: string): Promise<number> {
      const { count, error } = await client
        .from("project_members")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .is("removed_at", null);
      if (error) throw error;
      return count ?? 0;
    },

    async create(input: {
      actorId: string;
      project: ProjectCreate;
      requestId: string;
    }): Promise<Project> {
      const { data, error } = await client.rpc("admin_create_project", {
        p_actor_id: input.actorId,
        p_semester_id: input.project.semester_id,
        p_name: input.project.name,
        p_type: input.project.type,
        p_description: input.project.description,
        p_status: input.project.status,
        p_request_id: input.requestId,
      });
      if (error) throw error;
      return toProject(data as Project);
    },

    async update(input: {
      actorId: string;
      projectId: string;
      expectedUpdatedAt: string;
      changes: ProjectChanges;
      requestId: string;
    }): Promise<Project> {
      const { data, error } = await client.rpc("admin_update_project", {
        p_actor_id: input.actorId,
        p_project_id: input.projectId,
        p_expected_updated_at: input.expectedUpdatedAt,
        p_changes: input.changes,
        p_request_id: input.requestId,
      });
      if (error) throw error;
      return toProject(data as Project);
    },

    async archive(input: {
      actorId: string;
      projectId: string;
      cancelledCampaignId: string | null;
      requestId: string;
    }): Promise<Project> {
      const { data, error } = await client.rpc("admin_archive_project", {
        p_actor_id: input.actorId,
        p_project_id: input.projectId,
        p_cancelled_campaign_id: input.cancelledCampaignId,
        p_request_id: input.requestId,
      });
      if (error) throw error;
      return toProject(data as Project);
    },

    async unarchive(input: {
      actorId: string;
      projectId: string;
      requestId: string;
    }): Promise<Project> {
      const { data, error } = await client.rpc("admin_unarchive_project", {
        p_actor_id: input.actorId,
        p_project_id: input.projectId,
        p_request_id: input.requestId,
      });
      if (error) throw error;
      return toProject(data as Project);
    },
  };
}

export type ProjectRepository = ReturnType<typeof createProjectRepository>;
