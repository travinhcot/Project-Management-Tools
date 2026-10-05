import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FileSlot,
  FileTarget,
  ProjectType,
  Resource,
  ResourceFile,
  ResourceSlot,
} from "../model/resource.model.ts";

export interface PendingFile {
  readonly id: string;
  readonly bucket_id: string;
  readonly object_path: string;
}

export interface OrphanFile extends PendingFile {}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Unexpected database response.");
  return value as Record<string, unknown>;
}

function asRows(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data))
    throw new TypeError("Unexpected database response.");
  return data.map(asRecord);
}

function toFile(value: unknown): ResourceFile | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row) return null;
  const file = asRecord(row);
  return {
    id: String(file.id),
    original_filename: String(file.original_filename),
    content_type: String(file.content_type),
    size_bytes: Number(file.size_bytes),
    created_at: String(file.created_at),
  };
}

function toTarget(data: unknown): FileTarget | null {
  const row = asRows(data)[0];
  if (!row) return null;
  return {
    bucket_id: String(row.bucket_id),
    object_path: String(row.object_path),
    original_filename: String(row.original_filename),
  };
}

export function createResourceRepository(client: SupabaseClient) {
  return {
    async findProject(
      projectId: string,
    ): Promise<{ id: string; type: ProjectType } | null> {
      const { data, error } = await client
        .from("projects")
        .select("id,type")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data ? { id: data.id, type: data.type } : null;
    },

    async list(projectId: string): Promise<Resource[]> {
      const { data, error } = await client
        .from("project_resources")
        .select(
          "slot,source_type,url,label,updated_at,file:project_files(id,original_filename,content_type,size_bytes,created_at)",
        )
        .eq("project_id", projectId);
      if (error) throw error;
      return asRows(data).map((row) => ({
        slot: row.slot as ResourceSlot,
        source_type: row.source_type as Resource["source_type"],
        url: (row.url as string | null) ?? null,
        label: (row.label as string | null) ?? null,
        file: toFile(row.file),
        updated_at: String(row.updated_at),
      }));
    },

    /** One query for a whole page of projects. */
    async presentSlots(
      projectIds: readonly string[],
    ): Promise<{ project_id: string; slot: ResourceSlot }[]> {
      const { data, error } = await client
        .from("project_resources")
        .select("project_id,slot")
        .in("project_id", projectIds);
      if (error) throw error;
      return asRows(data).map((row) => ({
        project_id: String(row.project_id),
        slot: row.slot as ResourceSlot,
      }));
    },

    async setLink(input: {
      actorId: string;
      projectId: string;
      slot: ResourceSlot;
      url: string;
      label: string | null;
      requestId: string;
    }): Promise<void> {
      const { error } = await client.rpc("admin_set_project_resource_link", {
        p_actor_id: input.actorId,
        p_project_id: input.projectId,
        p_slot: input.slot,
        p_url: input.url,
        p_label: input.label,
        p_request_id: input.requestId,
      });
      if (error) throw error;
    },

    async clear(input: {
      actorId: string;
      projectId: string;
      slot: ResourceSlot;
      requestId: string;
    }): Promise<void> {
      const { error } = await client.rpc("admin_clear_project_resource", {
        p_actor_id: input.actorId,
        p_project_id: input.projectId,
        p_slot: input.slot,
        p_request_id: input.requestId,
      });
      if (error) throw error;
    },

    async beginUpload(input: {
      actorId: string;
      projectId: string;
      slot: FileSlot;
      bucketId: string;
      objectPath: string;
      filename: string;
      contentType: string;
      sizeBytes: number;
      checksum: string;
    }): Promise<PendingFile> {
      const { data, error } = await client.rpc("admin_begin_file_upload", {
        p_actor_id: input.actorId,
        p_project_id: input.projectId,
        p_slot: input.slot,
        p_bucket_id: input.bucketId,
        p_object_path: input.objectPath,
        p_original_filename: input.filename,
        p_content_type: input.contentType,
        p_size_bytes: input.sizeBytes,
        p_checksum_sha256: input.checksum,
      });
      if (error) throw error;
      const row = asRecord(data);
      return {
        id: String(row.id),
        bucket_id: String(row.bucket_id),
        object_path: String(row.object_path),
      };
    },

    async finalizeUpload(input: {
      actorId: string;
      fileId: string;
      requestId: string;
    }): Promise<ResourceFile> {
      const { data, error } = await client.rpc("finalize_file_upload", {
        p_actor_id: input.actorId,
        p_file_id: input.fileId,
        p_request_id: input.requestId,
      });
      if (error) throw error;
      const file = toFile(data);
      if (!file) throw new TypeError("Unexpected database response.");
      return file;
    },

    async abortUpload(actorId: string, fileId: string): Promise<void> {
      const { error } = await client.rpc("admin_abort_file_upload", {
        p_actor_id: actorId,
        p_file_id: fileId,
      });
      if (error) throw error;
    },

    async listOrphans(olderThanMinutes: number): Promise<OrphanFile[]> {
      const { data, error } = await client.rpc("list_orphan_uploads", {
        p_older_than_minutes: olderThanMinutes,
      });
      if (error) throw error;
      return asRows(data).map((row) => ({
        id: String(row.id),
        bucket_id: String(row.bucket_id),
        object_path: String(row.object_path),
      }));
    },

    async deleteOrphans(ids: readonly string[]): Promise<number> {
      const { data, error } = await client.rpc("delete_orphan_uploads", {
        p_ids: ids,
      });
      if (error) throw error;
      return Number(data);
    },

    async adminTarget(
      actorId: string,
      projectId: string,
      fileId: string,
    ): Promise<FileTarget | null> {
      const { data, error } = await client.rpc("admin_get_project_file", {
        p_actor_id: actorId,
        p_project_id: projectId,
        p_file_id: fileId,
      });
      if (error) throw error;
      return toTarget(data);
    },

    async memberTarget(
      actorId: string,
      projectId: string,
      fileId: string,
    ): Promise<FileTarget | null> {
      const { data, error } = await client.rpc("member_get_project_file", {
        p_actor_id: actorId,
        p_project_id: projectId,
        p_file_id: fileId,
      });
      if (error) throw error;
      return toTarget(data);
    },
  };
}
export type ResourceRepository = ReturnType<typeof createResourceRepository>;
