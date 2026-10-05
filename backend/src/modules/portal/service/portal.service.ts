import type { PortalRepository } from "../repository/portal.repository.ts";
import type {
  Eligibility,
  PortalDependencies,
  PortalListItem,
  PortalOptions,
  PortalProjectDetail,
  PortalProjectList,
  PortalProjectRow,
} from "../model/portal.model.ts";

import {
  NOT_ELIGIBLE,
  PROJECT_NOT_FOUND,
  portalError,
} from "../common/portal-errors.ts";
import { toResourceViews } from "../common/resource-view.ts";
import { BADGE_WINDOW_DAYS } from "../model/portal.model.ts";

export function createPortalService(
  repository: PortalRepository,
  { resources }: PortalDependencies,
  { allowPastSemesters = false }: PortalOptions = {},
) {
  async function guarded<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw portalError(error);
    }
  }

  /** The member area as a whole needs an eligible member (403), independent of any project. */
  async function requireEligible(actorId: string): Promise<void> {
    const { eligible } = await repository.eligibility(actorId);
    if (!eligible) throw NOT_ELIGIBLE;
  }

  return {
    /** Drives the "no access" page: signed in but not eligible sees no project data. */
    status(actorId: string): Promise<Eligibility> {
      return guarded(() => repository.eligibility(actorId));
    },

    listProjects(
      actorId: string,
      options: { includePast?: boolean } = {},
    ): Promise<PortalProjectList> {
      const includePast = allowPastSemesters && options.includePast === true;
      return guarded(async () => {
        await requireEligible(actorId);
        const rows = await repository.listProjects(actorId, includePast);
        const summaries = await resources.summarize(
          rows.map((row) => ({ id: row.id, type: row.type })),
        );
        const toItem = (row: PortalProjectRow): PortalListItem => {
          const summary = summaries.get(row.id);
          return {
            id: row.id,
            name: row.name,
            type: row.type,
            status: row.status,
            kickoff_at: row.kickoff_at,
            semester: { id: row.semester_id, name: row.semester_name },
            resources: summary
              ? { present: summary.present, missing: summary.missing }
              : null,
          };
        };
        return {
          items: rows.filter((row) => row.is_current).map(toItem),
          past: includePast
            ? rows.filter((row) => !row.is_current).map(toItem)
            : null,
        };
      });
    },

    getProject(
      actorId: string,
      projectId: string,
    ): Promise<PortalProjectDetail> {
      return guarded(async () => {
        await requireEligible(actorId);
        const project = await repository.getProject(
          actorId,
          projectId,
          allowPastSemesters,
        );
        if (!project) throw PROJECT_NOT_FOUND;
        const [teammates, listed] = await Promise.all([
          repository.teammates(actorId, projectId, allowPastSemesters),
          resources.listForProject(projectId),
        ]);
        return {
          id: project.id,
          name: project.name,
          type: project.type,
          description: project.description,
          status: project.status,
          kickoff_at: project.kickoff_at,
          semester: { id: project.semester_id, name: project.semester_name },
          resources: toResourceViews(
            project.id,
            project.type,
            listed.resources,
          ),
          teammates,
        };
      });
    },

    /** Interim notifications badge: resources of my current projects changed recently. */
    badge(actorId: string, now: Date = new Date()): Promise<{ count: number }> {
      return guarded(async () => {
        await requireEligible(actorId);
        const since = new Date(now.getTime() - BADGE_WINDOW_DAYS * 86_400_000);
        return { count: await repository.recentResourceCount(actorId, since) };
      });
    },
  };
}
export type PortalService = ReturnType<typeof createPortalService>;
