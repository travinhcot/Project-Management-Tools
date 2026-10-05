import type { RosterLookup } from "../model/project.model.ts";
import type {
  AssignRequest,
  BulkAssignResult,
  RemovedAssignment,
} from "../model/project-member.model.ts";
import type { ProjectMemberRepository } from "../repository/project-member.repository.ts";

import { HttpError } from "../../../shared/http-error.ts";
import { toMemberViews } from "../common/member-view.ts";
import {
  REASON_MESSAGES,
  assignmentError,
  reasonToHttpError,
} from "../common/assignment-errors.ts";

export function createProjectMemberService(
  repository: ProjectMemberRepository,
  roster: RosterLookup,
) {
  async function withAssignmentErrors<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw assignmentError(error);
    }
  }

  return {
    /** Single mode throws on a rejected id; bulk mode returns accepted + rejected. */
    assign(
      actorId: string,
      projectId: string,
      request: AssignRequest,
      requestId: string,
    ): Promise<BulkAssignResult> {
      return withAssignmentErrors(async () => {
        const outcome = await repository.assign({
          actorId,
          projectId,
          rosterMemberIds: request.rosterMemberIds,
          requestId,
        });
        if (request.mode === "single") {
          const rejection = outcome.rejected[0];
          if (rejection) throw reasonToHttpError(rejection.reason);
        }
        const people =
          outcome.accepted.length > 0
            ? await roster.findByIds(
                outcome.accepted.map((a) => a.roster_member_id),
              )
            : [];
        if (people.length < outcome.accepted.length) {
          // The write is already committed; don't report it as "unavailable".
          throw new HttpError(
            500,
            "ASSIGNMENT_VIEW_INCOMPLETE",
            "The assignment was saved, but its roster details could not be loaded.",
          );
        }
        return {
          accepted: toMemberViews(
            outcome.accepted.map((a) => ({
              id: a.assignment_id,
              roster_member_id: a.roster_member_id,
              added_at: a.added_at,
            })),
            people,
          ),
          rejected: outcome.rejected.map((r) => ({
            roster_member_id: r.roster_member_id,
            reason: r.reason,
            message: REASON_MESSAGES[r.reason],
          })),
        };
      });
    },

    /** Takes effect on the next request: nothing caches assignments. */
    remove(
      actorId: string,
      projectId: string,
      rosterMemberId: string,
      requestId: string,
    ): Promise<RemovedAssignment> {
      return withAssignmentErrors(() =>
        repository.remove({ actorId, projectId, rosterMemberId, requestId }),
      );
    },
  };
}

export type ProjectMemberService = ReturnType<
  typeof createProjectMemberService
>;
