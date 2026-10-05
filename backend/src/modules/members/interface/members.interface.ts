import type { SupabaseClient } from "@supabase/supabase-js";

import { createRosterMemberRepository } from "../repository/roster-member.repository.ts";
import { createRosterMemberService } from "../service/roster-member.service.ts";
import { createMemberAdminRouter } from "../routes/member-admin.routes.ts";

/** Public members-module entry point. Only composition roots import this file. */
export function createMembersInterface(databaseClient: SupabaseClient) {
  const members = createRosterMemberService(
    createRosterMemberRepository(databaseClient),
  );
  return {
    /** What other modules may ask of members, handed to them as a port in server.ts. */
    service: {
      countActiveMembers: (semesterId: string) =>
        members.countActiveMembers(semesterId),
      countActiveOverlap: (semesterA: string, semesterB: string) =>
        members.countActiveOverlap(semesterA, semesterB),
      findByIds: (ids: readonly string[]) => members.findByIds(ids),
    },
    adminRouter: createMemberAdminRouter(members),
  };
}

export type MembersInterface = ReturnType<typeof createMembersInterface>;
