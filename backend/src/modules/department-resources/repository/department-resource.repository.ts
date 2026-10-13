import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DepartmentCodeName,
  DepartmentResource,
  FileTarget,
  ResourceFields,
  ResourceUpdate,
} from "../model/department-resource.model.ts";

type Row = Record<string, unknown>;

function asRows(data: unknown): Row[] {
  if (!Array.isArray(data)) throw new TypeError("Unexpected database response.");
  return data as Row[];
}

function asRecord(data: unknown): Row {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new TypeError("Unexpected database response.");
  }
  return data as Row;
}

function toResource(row: Row): DepartmentResource {
  return {
    id: String(row.id),
    department_code: row.department_code as DepartmentCodeName,
    category: String(row.category),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    source_type: row.source_type as DepartmentResource["source_type"],
    url: (row.url as string | null) ?? null,
    file: row.file_id
      ? {
          id: String(row.file_id),
          original_filename: String(row.original_filename),
          content_type: String(row.content_type),
          size_bytes: Number(row.size_bytes),
        }
      : null,
    updated_by_name: (row.updated_by_name as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function createDepartmentResourceRepository(client: SupabaseClient) {
  return {
    async list(actorId: string, department: DepartmentCodeName | null): Promise<DepartmentResource[]> {
      const { data, error } = await client.rpc("dept_resources_list", {
        p_actor_id: actorId,
        p_department_code: department,
      });
      if (error) throw error;
      return asRows(data).map(toResource);
    },

    /** The row the function returns has no joins, so re-read the list entry for a full view. */
    async createLink(input: {
      actorId: string;
      department: DepartmentCodeName | null;
      title: string;
      category?: string;
      description?: string | null;
      url: string;
      requestId: string;
    }): Promise<string> {
      const { data, error } = await client.rpc("dept_resources_create_link", {
        p_actor_id: input.actorId,
        p_department_code: input.department,
        p_title: input.title,
        p_category: input.category ?? null,
        p_description: input.description ?? null,
        p_url: input.url,
        p_request_id: input.requestId,
      });
      if (error) throw error;
      return String(asRecord(data).id);
    },

    async update(input: {
      actorId: string;
      department: DepartmentCodeName | null;
      resourceId: string;
      changes: ResourceUpdate;
      requestId: string;
    }): Promise<string> {
      const { data, error } = await client.rpc("dept_resources_update", {
        p_actor_id: input.actorId,
        p_department_code: input.department,
        p_resource_id: input.resourceId,
        p_changes: input.changes,
        p_request_id: input.requestId,
      });
      if (error) throw error;
      return String(asRecord(data).id);
    },

    async remove(input: {
      actorId: string;
      department: DepartmentCodeName | null;
      resourceId: string;
      requestId: string;
    }): Promise<void> {
      const { error } = await client.rpc("dept_resources_delete", {
        p_actor_id: input.actorId,
        p_department_code: input.department,
        p_resource_id: input.resourceId,
        p_request_id: input.requestId,
      });
      if (error) throw error;
    },

    async beginUpload(input: {
      actorId: string;
      department: DepartmentCodeName | null;
      bucketId: string;
      objectPath: string;
      filename: string;
      contentType: string;
      sizeBytes: number;
      checksum: string;
    }): Promise<{ id: string; bucket_id: string; object_path: string }> {
      const { data, error } = await client.rpc("dept_resources_begin_file", {
        p_actor_id: input.actorId,
        p_department_code: input.department,
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
      department: DepartmentCodeName | null;
      fileId: string;
      resourceId: string | null;
      fields: ResourceFields;
      requestId: string;
    }): Promise<string> {
      const { data, error } = await client.rpc("dept_resources_finalize_file", {
        p_actor_id: input.actorId,
        p_department_code: input.department,
        p_file_id: input.fileId,
        p_resource_id: input.resourceId,
        p_changes: input.fields,
        p_request_id: input.requestId,
      });
      if (error) throw error;
      return String(asRecord(data).id);
    },

    async abortUpload(actorId: string, department: DepartmentCodeName | null, fileId: string): Promise<void> {
      const { error } = await client.rpc("dept_resources_abort_file", {
        p_actor_id: actorId,
        p_department_code: department,
        p_file_id: fileId,
      });
      if (error) throw error;
    },

    async fileTarget(
      actorId: string,
      department: DepartmentCodeName | null,
      resourceId: string,
    ): Promise<FileTarget | null> {
      const { data, error } = await client.rpc("dept_resources_get_file", {
        p_actor_id: actorId,
        p_department_code: department,
        p_resource_id: resourceId,
      });
      if (error) throw error;
      const rows = asRows(data);
      if (rows.length === 0) return null;
      return {
        bucket_id: String(rows[0].bucket_id),
        object_path: String(rows[0].object_path),
        original_filename: String(rows[0].original_filename),
      };
    },

    async listOrphans(olderThanMinutes: number): Promise<{ id: string; bucket_id: string; object_path: string }[]> {
      const { data, error } = await client.rpc("list_orphan_department_uploads", {
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
      const { data, error } = await client.rpc("delete_orphan_department_uploads", { p_ids: [...ids] });
      if (error) throw error;
      return Number(data ?? 0);
    },
  };
}
export type DepartmentResourceRepository = ReturnType<typeof createDepartmentResourceRepository>;
