import type {
  RosterListQuery,
  RosterMember,
  RosterMemberChanges,
  RosterMemberCreate,
  RosterMemberView,
} from "../model/roster-member.model.ts";
import type { RosterMemberRepository } from "../repository/roster-member.repository.ts";
import type { Page } from "../../../shared/pagination.ts";

import { memberError } from "../common/member-errors.ts";

function view(member: RosterMember): RosterMemberView {
  return { ...member, linked: member.user_id !== null };
}

export function createRosterMemberService(repository: RosterMemberRepository) {
  return {
    async list(query: RosterListQuery): Promise<Page<RosterMemberView>> {
      try {
        const { rows, total } = await repository.list(query);
        return {
          items: rows.map(view),
          page: query.page,
          size: query.size,
          total,
        };
      } catch (error) {
        throw memberError(error);
      }
    },

    async add(
      actorId: string,
      semesterId: string,
      member: RosterMemberCreate,
      requestId: string,
    ): Promise<RosterMemberView> {
      try {
        return view(
          await repository.add({ actorId, semesterId, member, requestId }),
        );
      } catch (error) {
        throw memberError(error);
      }
    },

    async update(
      actorId: string,
      rosterMemberId: string,
      changes: RosterMemberChanges,
      requestId: string,
    ): Promise<RosterMemberView> {
      try {
        return view(
          await repository.update({
            actorId,
            rosterMemberId,
            changes,
            requestId,
          }),
        );
      } catch (error) {
        throw memberError(error);
      }
    },

    /** Public API for other modules (wired as a port in server.ts). */
    async countActiveMembers(semesterId: string): Promise<number> {
      try {
        return await repository.countActive(semesterId);
      } catch (error) {
        throw memberError(error);
      }
    },
  };
}

export type RosterMemberService = ReturnType<typeof createRosterMemberService>;
