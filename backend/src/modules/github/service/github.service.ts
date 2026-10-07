import type { GithubProvider } from "../provider/github.provider.ts";
import type { GithubRepository } from "../repository/github.repository.ts";
import type {
  GithubActivity,
  GithubDependencies,
  GithubOptions,
  SnapshotRow,
} from "../model/github.model.ts";

import { PROJECT_NOT_FOUND, githubError } from "../common/github-errors.ts";
import { parseGithubRepoUrl } from "../common/github-url.ts";

/** A manual refresh inside this window just returns the stored snapshot. */
const REFRESH_COOLDOWN_MS = 30_000;
/** Failed fetches and "still computing" snapshots are retried sooner than good ones. */
const RETRY_AFTER_ERROR_MS = 60_000;
const RETRY_AFTER_PENDING_MS = 10_000;

const EMPTY: GithubActivity = {
  status: "NO_REPO",
  repo_full_name: null,
  fetched_at: null,
  data: null,
};

export function createGithubService(
  repository: GithubRepository,
  provider: GithubProvider,
  { memberCanView }: GithubDependencies,
  { staleMinutes = 15 }: Pick<GithubOptions, "staleMinutes"> = {},
) {
  const staleMs = Math.max(1, staleMinutes) * 60_000;
  /** Concurrent readers of one project share a single GitHub fetch. */
  const inFlight = new Map<string, Promise<GithubActivity>>();

  async function guarded<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw githubError(error);
    }
  }

  const toActivity = (row: SnapshotRow): GithubActivity => ({
    status: row.status,
    repo_full_name: row.repo_full_name,
    fetched_at: row.fetched_at,
    data: row.data,
  });

  function isFresh(row: SnapshotRow): boolean {
    const age = Date.now() - new Date(row.fetched_at).getTime();
    if (row.status !== "OK") return age < RETRY_AFTER_ERROR_MS;
    if (row.data?.stats_pending) return age < RETRY_AFTER_PENDING_MS;
    return age < staleMs;
  }

  async function build(projectId: string, force: boolean): Promise<GithubActivity> {
    const url = await repository.repoUrl(projectId);
    if (!url) {
      await repository.deleteSnapshot(projectId);
      return EMPTY;
    }
    const ref = parseGithubRepoUrl(url);
    if (!ref) {
      await repository.deleteSnapshot(projectId);
      return { ...EMPTY, status: "INVALID_REPO" };
    }

    const stored = await repository.findSnapshot(projectId);
    // A snapshot of a previous link is never shown.
    const current = stored?.repo_full_name === ref.fullName ? stored : null;
    if (current) {
      const age = Date.now() - new Date(current.fetched_at).getTime();
      if (isFresh(current) || (force && age < REFRESH_COOLDOWN_MS))
        return toActivity(current);
    }

    const result = await provider.fetchActivity(ref);
    if (result.ok) {
      return toActivity(
        await repository.saveSnapshot(projectId, ref.fullName, "OK", result.data),
      );
    }
    // Keep the last good numbers when GitHub is rate limiting or failing.
    const keep = current?.data ?? null;
    return toActivity(
      await repository.saveSnapshot(projectId, ref.fullName, result.status, keep),
    );
  }

  function activityFor(projectId: string, force: boolean): Promise<GithubActivity> {
    const running = inFlight.get(projectId);
    if (running) return running;
    const task = guarded(() => build(projectId, force)).finally(() =>
      inFlight.delete(projectId),
    );
    inFlight.set(projectId, task);
    return task;
  }

  return {
    /** Admin view of any project. */
    getForAdmin(projectId: string): Promise<GithubActivity> {
      return activityFor(projectId, false);
    },

    refreshForAdmin(projectId: string): Promise<GithubActivity> {
      return activityFor(projectId, true);
    },

    /** Member view: only for projects the member is assigned to (404 otherwise, like the portal). */
    async getForMember(actorId: string, projectId: string): Promise<GithubActivity> {
      const allowed = await guarded(() => memberCanView(actorId, projectId));
      if (!allowed) throw PROJECT_NOT_FOUND;
      return activityFor(projectId, false);
    },

    /** Scheduler entry point: refreshes every project that has a repo link, one after another. */
    async refreshAll(): Promise<{ projects: number; failed: number }> {
      const ids = await guarded(() => repository.projectsWithRepo());
      let failed = 0;
      for (const id of ids) {
        try {
          const activity = await activityFor(id, true);
          if (activity.status === "RATE_LIMITED") {
            failed += 1;
            break;
          }
          if (activity.status === "ERROR") failed += 1;
        } catch {
          failed += 1;
        }
      }
      return { projects: ids.length, failed };
    },
  };
}

export type GithubService = ReturnType<typeof createGithubService>;
