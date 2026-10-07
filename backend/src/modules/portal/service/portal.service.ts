import type { PortalRepository } from "../repository/portal.repository.ts";
import type {
  ComingUpItem,
  Eligibility,
  PortalDependencies,
  PortalListItem,
  PortalOptions,
  PortalOverview,
  PortalProfile,
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

  /** The member's name is the last word in Vietnamese order ("Bùi Hoàng Nam" -> "Nam"). */
  function firstName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    return parts[parts.length - 1] ?? "";
  }

  async function buildList(
    actorId: string,
    includePast: boolean,
  ): Promise<PortalProjectList> {
    const rows = await repository.listProjects(actorId, includePast);
    const [summaries, details, heads] = await Promise.all([
      resources.summarize(rows.map((row) => ({ id: row.id, type: row.type }))),
      Promise.all(rows.map((row) => resources.listForProject(row.id))),
      repository.summaries(actorId, includePast),
    ]);
    const toItem = (row: PortalProjectRow, index: number): PortalListItem => {
      const summary = summaries.get(row.id);
      const head = heads.get(row.id);
      return {
        id: row.id,
        name: row.name,
        type: row.type,
        status: row.status,
        kickoff_at: row.kickoff_at,
        semester: { id: row.semester_id, name: row.semester_name },
        leader_name: head?.leader_name ?? null,
        member_count: head?.member_count ?? 0,
        resources: summary
          ? { present: summary.present, missing: summary.missing }
          : null,
        resource_views: toResourceViews(
          row.id,
          row.type,
          details[index]?.resources ?? [],
        ),
      };
    };
    const indexed = rows.map((row, index) => ({ row, index }));
    return {
      items: indexed
        .filter(({ row }) => row.is_current)
        .map(({ row, index }) => toItem(row, index)),
      past: includePast
        ? indexed
            .filter(({ row }) => !row.is_current)
            .map(({ row, index }) => toItem(row, index))
        : null,
    };
  }

  return {
    /** Drives the "no access" page: signed in but not eligible sees no project data. */
    status(
      actorId: string,
    ): Promise<Eligibility & { email: string | null; full_name: string | null }> {
      return guarded(async () => {
        const [eligibility, profile] = await Promise.all([
          repository.eligibility(actorId),
          repository.profile(actorId),
        ]);
        return {
          ...eligibility,
          email: profile?.email ?? null,
          full_name: profile?.full_name ?? null,
        };
      });
    },

    listProjects(
      actorId: string,
      options: { includePast?: boolean } = {},
    ): Promise<PortalProjectList> {
      const includePast = allowPastSemesters && options.includePast === true;
      return guarded(async () => {
        await requireEligible(actorId);
        return buildList(actorId, includePast);
      });
    },

    /** Overview page: my projects plus the next meeting and what was recently shared. */
    overview(actorId: string, now: Date = new Date()): Promise<PortalOverview> {
      return guarded(async () => {
        await requireEligible(actorId);
        const [{ items }, profile, semesters] = await Promise.all([
          buildList(actorId, false),
          repository.profile(actorId),
          repository.semesters(actorId),
        ]);
        const current = semesters.find((row) => row.is_current) ?? null;
        const upcoming = items
          .filter((item) => item.kickoff_at && new Date(item.kickoff_at) >= now)
          .sort((a, b) => a.kickoff_at!.localeCompare(b.kickoff_at!));
        const comingUp: ComingUpItem[] = [];
        for (const item of upcoming) {
          const meeting = item.resource_views.find(
            (view) => view.slot === "FIRST_MEETING" && view.kind === "LINK",
          );
          comingUp.push({
            kind: meeting ? "FIRST_MEETING" : "KICKOFF",
            project_id: item.id,
            project_name: item.name,
            at: item.kickoff_at,
            url: meeting && meeting.kind === "LINK" ? meeting.url : null,
            file: null,
            download_url_path: null,
          });
        }
        for (const item of items) {
          const bom = item.resource_views.find(
            (view) => view.slot === "BOM" && view.kind === "FILE",
          );
          if (bom && bom.kind === "FILE") {
            comingUp.push({
              kind: "BOM",
              project_id: item.id,
              project_name: item.name,
              at: null,
              url: null,
              file: {
                id: bom.file.id,
                filename: bom.file.filename,
                size_bytes: bom.file.size_bytes,
              },
              download_url_path: bom.download_url_path,
            });
          }
        }
        const next = upcoming[0];
        return {
          semester: current
            ? { id: current.semester_id, name: current.name, ends_on: current.ends_on }
            : null,
          first_name: firstName(profile?.full_name ?? ""),
          projects: items,
          next_meeting: next
            ? { project_id: next.id, project_name: next.name, at: next.kickoff_at! }
            : null,
          coming_up: comingUp,
        };
      });
    },

    /** Own details only, so it also works for a signed-in member who is not on the roster. */
    profile(actorId: string): Promise<PortalProfile> {
      return guarded(async () => {
        const [row, semesters] = await Promise.all([
          repository.profile(actorId),
          repository.semesters(actorId),
        ]);
        if (!row) throw NOT_ELIGIBLE;
        return {
          full_name: row.full_name,
          email: row.email,
          department: row.department,
          role: "MEMBER",
          semesters: semesters.map((s) => ({
            id: s.semester_id,
            name: s.name,
            is_current: s.is_current,
            ends_on: s.ends_on,
            project_count: s.project_count,
          })),
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
