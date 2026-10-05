import type {
  CurrentSwitchImpact,
  RosterStatsGateway,
  Semester,
  SemesterChanges,
  SemesterCreate,
  SemesterListQuery,
} from "../model/semester.model.ts";
import type { SemesterRepository } from "../repository/semester.repository.ts";

import { HttpError } from "../../../shared/http-error.ts";
import { dbError } from "../../../shared/db-error.ts";

function semesterError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  const { code, message } = dbError(error);
  if (code === "42501") {
    return new HttpError(
      403,
      "FORBIDDEN",
      "You do not have permission for this action.",
    );
  }
  if (
    code === "22023" ||
    code === "23514" ||
    code === "22007" ||
    code === "22008"
  ) {
    return new HttpError(
      400,
      "INVALID_INPUT",
      "The request contains invalid values.",
    );
  }
  if (code === "P0002")
    return new HttpError(404, "SEMESTER_NOT_FOUND", "Semester not found.");
  if (code === "23505") {
    return new HttpError(
      409,
      "SEMESTER_EXISTS",
      "A semester with this term and year already exists.",
    );
  }
  if (code === "P0001" && message === "SEMESTER_ALREADY_CURRENT") {
    return new HttpError(
      409,
      "SEMESTER_ALREADY_CURRENT",
      "This semester is already the current one.",
    );
  }
  return new HttpError(
    503,
    "SEMESTERS_UNAVAILABLE",
    "Semester management is temporarily unavailable.",
  );
}

export function createSemesterService(
  repository: SemesterRepository,
  rosterStats: RosterStatsGateway,
) {
  async function getOrThrow(id: string): Promise<Semester> {
    let semester: Semester | null;
    try {
      semester = await repository.findById(id);
    } catch (error) {
      throw semesterError(error);
    }
    if (!semester)
      throw new HttpError(404, "SEMESTER_NOT_FOUND", "Semester not found.");
    return semester;
  }

  return {
    async list(query: SemesterListQuery): Promise<Semester[]> {
      try {
        return await repository.list(query);
      } catch (error) {
        throw semesterError(error);
      }
    },

    get: getOrThrow,

    async create(
      actorId: string,
      semester: SemesterCreate,
      requestId: string,
    ): Promise<Semester> {
      try {
        return await repository.create({ actorId, semester, requestId });
      } catch (error) {
        throw semesterError(error);
      }
    },

    async update(
      actorId: string,
      semesterId: string,
      changes: SemesterChanges,
      requestId: string,
    ): Promise<Semester> {
      try {
        return await repository.update({
          actorId,
          semesterId,
          changes,
          requestId,
        });
      } catch (error) {
        throw semesterError(error);
      }
    },

    /** Read-only preview shown in the confirmation dialog before set-current. */
    async currentImpact(targetId: string): Promise<CurrentSwitchImpact> {
      const target = await getOrThrow(targetId);
      let current: Semester | null;
      try {
        current = await repository.findCurrent();
      } catch (error) {
        throw semesterError(error);
      }
      if (current?.id === target.id) {
        return {
          target,
          current: { id: target.id, name: target.name },
          members_losing_access: 0,
          members_gaining_access: 0,
          members_carried_over: 0,
        };
      }
      const [currentActive, targetActive, shared] = await Promise.all([
        current
          ? rosterStats.countActiveMembers(current.id)
          : Promise.resolve(0),
        rosterStats.countActiveMembers(target.id),
        current
          ? rosterStats.countActiveOverlap(current.id, target.id)
          : Promise.resolve(0),
      ]);
      return {
        target,
        current: current ? { id: current.id, name: current.name } : null,
        ...switchImpactCounts(currentActive, targetActive, shared),
      };
    },

    async setCurrent(
      actorId: string,
      semesterId: string,
      requestId: string,
    ): Promise<Semester> {
      try {
        return await repository.setCurrent({ actorId, semesterId, requestId });
      } catch (error) {
        throw semesterError(error);
      }
    },
  };
}

/** Pure: access changes when switching, given active counts and the same-email overlap. */
export function switchImpactCounts(
  currentActive: number,
  targetActive: number,
  shared: number,
) {
  return {
    members_losing_access: Math.max(currentActive - shared, 0),
    members_gaining_access: Math.max(targetActive - shared, 0),
    members_carried_over: shared,
  };
}

export type SemesterService = ReturnType<typeof createSemesterService>;
