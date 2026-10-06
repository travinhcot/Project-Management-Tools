import type {
  ArchiveImpact,
  KickoffRef,
  Project,
  ProjectChanges,
  ProjectCreate,
  ProjectDependencies,
  ProjectDetail,
  ProjectListItem,
  ProjectListQuery,
  SemesterRef,
} from "../model/project.model.ts";
import type { ProjectRepository } from "../repository/project.repository.ts";
import type { Page } from "../../../shared/pagination.ts";

import { HttpError } from "../../../shared/http-error.ts";
import { projectError } from "../common/project-errors.ts";
import { leaderOf, toMemberViews } from "../common/member-view.ts";

export interface ProjectListResult extends Page<ProjectListItem> {
  readonly semester: SemesterRef | null;
}

export function createProjectService(
  repository: ProjectRepository,
  dependencies: ProjectDependencies,
) {
  const { semesters, roster, resources, kickoffs } = dependencies;

  async function guarded<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw projectError(error);
    }
  }

  async function getOrThrow(id: string): Promise<Project> {
    const project = await guarded(() => repository.findById(id));
    if (!project) {
      throw new HttpError(404, "PROJECT_NOT_FOUND", "Project not found.");
    }
    return project;
  }

  return {
    /** Offered to the semesters module as a port (see projects.interface.ts). */
    countProjects(semesterId: string): Promise<number> {
      return guarded(() => repository.countInSemester(semesterId));
    },

    async list(query: ProjectListQuery): Promise<ProjectListResult> {
      const semester = await guarded(() =>
        query.semesterId
          ? semesters.findById(query.semesterId)
          : semesters.findCurrent(),
      );
      if (!semester) {
        if (query.semesterId) {
          throw new HttpError(404, "SEMESTER_NOT_FOUND", "Semester not found.");
        }
        return {
          semester: null,
          items: [],
          page: query.page,
          size: query.size,
          total: 0,
        };
      }
      return guarded(async () => {
        const { rows, total } = await repository.list(query, semester.id);
        const summaries = resources
          ? await resources.summarize(
              rows.map((r) => ({ id: r.id, type: r.type })),
            )
          : null;
        const kickoffSummaries = kickoffs
          ? await kickoffs.summarize(rows.map((r) => r.id))
          : null;
        const items = rows.map((row) => ({
          ...row,
          resources: summaries?.get(row.id) ?? null,
          kickoff: kickoffSummaries?.get(row.id) ?? null,
        }));
        return { semester, items, page: query.page, size: query.size, total };
      });
    },

    async get(id: string): Promise<ProjectDetail> {
      const project = await getOrThrow(id);
      return guarded(async () => {
        const [semester, assignments, kickoff, summaries] = await Promise.all([
          semesters.findById(project.semester_id),
          repository.activeAssignments(id),
          kickoffs ? kickoffs.findActiveKickoff(id) : Promise.resolve(null),
          resources
            ? resources.summarize([{ id: project.id, type: project.type }])
            : Promise.resolve(null),
        ]);
        const people = await roster.findByIds(
          assignments.map((a) => a.roster_member_id),
        );
        const members = toMemberViews(assignments, people);
        return {
          project,
          semester,
          members,
          leader: leaderOf(members),
          resources: summaries?.get(project.id) ?? null,
          kickoff,
        };
      });
    },

    // Editing never creates or resends a campaign: this service has no email dependency to call.
    create(actorId: string, project: ProjectCreate, requestId: string) {
      return guarded(() => repository.create({ actorId, project, requestId }));
    },

    update(
      actorId: string,
      projectId: string,
      expectedUpdatedAt: string,
      changes: ProjectChanges,
      requestId: string,
    ) {
      return guarded(() =>
        repository.update({
          actorId,
          projectId,
          expectedUpdatedAt,
          changes,
          requestId,
        }),
      );
    },

    /** Read-only data for the archive confirmation dialog. */
    async archiveImpact(id: string): Promise<ArchiveImpact> {
      const project = await getOrThrow(id);
      return guarded(async () => {
        const [activeMembers, kickoff] = await Promise.all([
          repository.countActiveAssignments(id),
          kickoffs ? kickoffs.findActiveKickoff(id) : Promise.resolve(null),
        ]);
        return { project, active_members: activeMembers, kickoff };
      });
    },

    async archive(
      actorId: string,
      projectId: string,
      options: { cancelKickoff: boolean },
      requestId: string,
    ): Promise<Project> {
      const project = await getOrThrow(projectId);
      if (project.archived_at) {
        throw new HttpError(
          409,
          "PROJECT_ALREADY_ARCHIVED",
          "This project is already archived.",
        );
      }
      let cancelledCampaignId: string | null = null;
      if (kickoffs) {
        const kickoff: KickoffRef | null = await guarded(() =>
          kickoffs.findActiveKickoff(projectId),
        );
        if (kickoff) {
          if (kickoff.status === "PROCESSING") {
            throw new HttpError(
              409,
              "KICKOFF_IN_PROGRESS",
              "The kick-off email is being sent right now. Try again when it finishes.",
            );
          }
          if (!options.cancelKickoff) {
            throw new HttpError(
              409,
              "KICKOFF_SCHEDULED",
              `A kick-off email is scheduled for ${kickoff.scheduled_at}. Archive with cancel_kickoff: true to cancel it.`,
            );
          }
          // Cancel first: if it fails nothing is archived; if the archive then fails the admin retries.
          await guarded(() =>
            kickoffs.cancel({ campaignId: kickoff.id, actorId, requestId }),
          );
          cancelledCampaignId = kickoff.id;
        }
      }
      return guarded(() =>
        repository.archive({
          actorId,
          projectId,
          cancelledCampaignId,
          requestId,
        }),
      );
    },

    unarchive(actorId: string, projectId: string, requestId: string) {
      return guarded(() =>
        repository.unarchive({ actorId, projectId, requestId }),
      );
    },
  };
}

export type ProjectService = ReturnType<typeof createProjectService>;
