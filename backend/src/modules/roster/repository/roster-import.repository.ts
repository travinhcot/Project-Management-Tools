import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ImportMissingMember,
  ImportRowInput,
  ImportRowStatus,
  ImportRowView,
  RosterImportListItem,
  RosterImportSummary,
} from "../model/roster-import.model.ts";

const listColumns =
  "id,semester_id,initiated_by_user_id,filename,status,total_rows,valid_rows,update_rows,invalid_rows,deactivate_missing,deactivated_rows,expires_at,created_at,committed_at";
const rowColumns = "row_number,full_name,email,major,status,errors";

export function createRosterImportRepository(client: SupabaseClient) {
  return {
    async createPreview(input: {
      actorId: string;
      semesterId: string;
      filename: string;
      checksum: string;
      rows: readonly ImportRowInput[];
      requestId: string;
    }): Promise<string> {
      const { data, error } = await client.rpc("roster_create_import_preview", {
        p_actor_id: input.actorId,
        p_semester_id: input.semesterId,
        p_filename: input.filename,
        p_checksum: input.checksum,
        p_rows: input.rows,
        p_request_id: input.requestId,
      });
      if (error) throw error;
      return (data as { id: string }).id;
    },

    async getSummary(importId: string): Promise<RosterImportSummary> {
      const { data, error } = await client.rpc("admin_get_roster_import", {
        p_import_id: importId,
      });
      if (error) throw error;
      return (data as RosterImportSummary[])[0]!;
    },

    async listForSemester(
      semesterId: string,
      page: number,
      size: number,
    ): Promise<{ rows: RosterImportListItem[]; total: number }> {
      const from = (page - 1) * size;
      const { data, error, count } = await client
        .from("roster_imports")
        .select(listColumns, { count: "exact" })
        .eq("semester_id", semesterId)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, from + size - 1);
      if (error) throw error;
      return {
        rows: (data ?? []) as RosterImportListItem[],
        total: count ?? 0,
      };
    },

    async listRows(
      importId: string,
      status: ImportRowStatus | undefined,
      page: number,
      size: number,
    ): Promise<{ rows: ImportRowView[]; total: number }> {
      const from = (page - 1) * size;
      let query = client
        .from("roster_import_rows")
        .select(rowColumns, { count: "exact" })
        .eq("import_id", importId);
      if (status) query = query.eq("status", status);
      const { data, error, count } = await query
        .order("row_number")
        .range(from, from + size - 1);
      if (error) throw error;
      return { rows: (data ?? []) as ImportRowView[], total: count ?? 0 };
    },

    async listMissing(
      importId: string,
      page: number,
      size: number,
    ): Promise<{ rows: ImportMissingMember[]; total: number }> {
      const { data, error } = await client.rpc("admin_list_import_missing", {
        p_import_id: importId,
        p_limit: size,
        p_offset: (page - 1) * size,
      });
      if (error) throw error;
      const rows = (data ?? []) as (ImportMissingMember & {
        total_count: number;
      })[];
      let total = rows[0]?.total_count ?? 0;
      if (rows.length === 0 && page > 1) {
        // Past the last page the window count has no row to ride on; ask for the first row.
        const { data: first, error: firstError } = await client.rpc(
          "admin_list_import_missing",
          { p_import_id: importId, p_limit: 1, p_offset: 0 },
        );
        if (firstError) throw firstError;
        total =
          ((first ?? []) as { total_count: number }[])[0]?.total_count ?? 0;
      }
      return {
        rows: rows.map(({ total_count: _total, ...member }) => member),
        total,
      };
    },

    async commit(input: {
      actorId: string;
      importId: string;
      deactivateMissing: boolean;
      requestId: string;
    }): Promise<void> {
      const { error } = await client.rpc("roster_commit_import", {
        p_actor_id: input.actorId,
        p_import_id: input.importId,
        p_deactivate_missing: input.deactivateMissing,
        p_request_id: input.requestId,
      });
      if (error) throw error;
    },
  };
}

export type RosterImportRepository = ReturnType<
  typeof createRosterImportRepository
>;
