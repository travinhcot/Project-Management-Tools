import type {
  RosterListQuery,
  RosterMember,
  RosterMemberChanges,
  RosterMemberCreate,
  RosterMemberView,
  RosterDeleteImpact,
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

    async deleteImpact(
      actorId: string,
      rosterMemberId: string,
    ): Promise<RosterDeleteImpact> {
      try {
        return await repository.deleteImpact({ actorId, rosterMemberId });
      } catch (error) {
        throw memberError(error);
      }
    },

    async delete(
      actorId: string,
      rosterMemberId: string,
      requestId: string,
    ): Promise<{ authUserRemoved: boolean }> {
      try {
        return await repository.deleteMember({
          actorId,
          rosterMemberId,
          requestId,
        });
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

    async findByIds(ids: readonly string[]) {
      try {
        return await repository.findByIds(ids);
      } catch (error) {
        throw memberError(error);
      }
    },

    async countActiveOverlap(
      semesterA: string,
      semesterB: string,
    ): Promise<number> {
      try {
        return await repository.countActiveOverlap(semesterA, semesterB);
      } catch (error) {
        throw memberError(error);
      }
    },
  };
}

export type RosterMemberService = ReturnType<typeof createRosterMemberService>;
