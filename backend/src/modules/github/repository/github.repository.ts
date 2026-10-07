import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActivityData,
  SnapshotRow,
  SnapshotStatus,
} from "../model/github.model.ts";

export function createGithubRepository(client: SupabaseClient) {
  return {
    /** The project's GITHUB_REPO link (reads project_resources, owned by files). */
    async repoUrl(projectId: string): Promise<string | null> {
      const { data, error } = await client
        .from("project_resources")
        .select("url")
        .eq("project_id", projectId)
        .eq("slot", "GITHUB_REPO")
        .maybeSingle();
      if (error) throw error;
      return (data?.url as string | null | undefined) ?? null;
    },

    async projectsWithRepo(): Promise<string[]> {
      const { data, error } = await client
        .from("project_resources")
        .select("project_id")
        .eq("slot", "GITHUB_REPO");
      if (error) throw error;
      return (data ?? []).map((row) => String(row.project_id));
    },

    async findSnapshot(projectId: string): Promise<SnapshotRow | null> {
      const { data, error } = await client
        .from("project_github_snapshots")
        .select("project_id, repo_full_name, status, data, fetched_at")
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data ? (data as SnapshotRow) : null;
    },

    async saveSnapshot(
      projectId: string,
      repoFullName: string,
      status: SnapshotStatus,
      data: ActivityData | null,
    ): Promise<SnapshotRow> {
      const { data: row, error } = await client
        .from("project_github_snapshots")
        .upsert({
          project_id: projectId,
          repo_full_name: repoFullName,
          status,
          data,
          fetched_at: new Date().toISOString(),
        })
        .select("project_id, repo_full_name, status, data, fetched_at")
        .single();
      if (error) throw error;
      return row as SnapshotRow;
    },

    async deleteSnapshot(projectId: string): Promise<void> {
      const { error } = await client
        .from("project_github_snapshots")
        .delete()
        .eq("project_id", projectId);
      if (error) throw error;
    },
  };
}

export type GithubRepository = ReturnType<typeof createGithubRepository>;
