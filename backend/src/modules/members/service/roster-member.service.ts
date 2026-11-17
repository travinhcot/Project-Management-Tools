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

/** Outcome of creating the login account for a manually added member. */
export interface AccountResult {
  readonly status: "linked" | "would" | "skipped" | "failed";
  readonly detail: string;
}

/** What members needs from roster provisioning (wired in server.ts). Must not throw. */
export interface AccountProvisioner {
  provisionRosterMember(rosterMemberId: string): Promise<AccountResult | null>;
}

export function createRosterMemberService(
  repository: RosterMemberRepository,
  provisioner?: AccountProvisioner,
) {
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
    ): Promise<{ member: RosterMemberView; account: AccountResult | null }> {
      let added: RosterMember;
      try {
        added = await repository.add({ actorId, semesterId, member, requestId });
      } catch (error) {
        throw memberError(error);
      }
      // Same as CSV import: give the person an account so they show up in User & Access.
      const account =
        added.user_id === null && provisioner
          ? await provisioner.provisionRosterMember(added.id)
          : null;
      const shown = view(added);
      return {
        member: { ...shown, linked: shown.linked || account?.status === "linked" },
        account: account && { status: account.status, detail: account.detail },
      };
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
