import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Semester,
  SemesterChanges,
  SemesterCreate,
  SemesterListQuery,
} from "../model/semester.model.ts";

const columns =
  "id,term,year,name,is_current,starts_on,ends_on,demo_registration_url,kickoff_meeting_url,created_at,updated_at";

export function createSemesterRepository(client: SupabaseClient) {
  return {
    async list(query: SemesterListQuery): Promise<Semester[]> {
      let request = client.from("semesters").select(columns);
      if (query.year !== undefined) request = request.eq("year", query.year);
      if (query.term !== undefined) request = request.eq("term", query.term);
      const { data, error } = await request
        .order("year", { ascending: false })
        .order("term", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Semester[];
    },

    async findById(id: string): Promise<Semester | null> {
      const { data, error } = await client
        .from("semesters")
        .select(columns)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Semester | null;
    },

    async findCurrent(): Promise<Semester | null> {
      const { data, error } = await client
        .from("semesters")
        .select(columns)
        .eq("is_current", true)
        .maybeSingle();
      if (error) throw error;
      return data as Semester | null;
    },

    async create(input: {
      actorId: string;
      semester: SemesterCreate;
      requestId: string;
    }): Promise<Semester> {
      const { data, error } = await client.rpc("admin_create_semester", {
        p_actor_id: input.actorId,
        p_term: input.semester.term,
        p_year: input.semester.year,
        p_starts_on: input.semester.starts_on,
        p_ends_on: input.semester.ends_on,
        p_demo_registration_url: input.semester.demo_registration_url,
        p_request_id: input.requestId,
      });
      if (error) throw error;
      return data as Semester;
    },

    async update(input: {
      actorId: string;
      semesterId: string;
      changes: SemesterChanges;
      requestId: string;
    }): Promise<Semester> {
      const { data, error } = await client.rpc("admin_update_semester", {
        p_actor_id: input.actorId,
        p_semester_id: input.semesterId,
        p_changes: input.changes,
        p_request_id: input.requestId,
      });
      if (error) throw error;
      return data as Semester;
    },

    async setCurrent(input: {
      actorId: string;
      semesterId: string;
      requestId: string;
    }): Promise<Semester> {
      const { data, error } = await client.rpc("admin_set_current_semester", {
        p_actor_id: input.actorId,
        p_semester_id: input.semesterId,
        p_request_id: input.requestId,
      });
      if (error) throw error;
      return data as Semester;
    },
  };
}

export type SemesterRepository = ReturnType<typeof createSemesterRepository>;
