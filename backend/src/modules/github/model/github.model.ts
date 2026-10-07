export type SnapshotStatus =
  | "OK"
  | "NOT_FOUND"
  | "NO_ACCESS"
  | "RATE_LIMITED"
  | "ERROR";

/** What the API answers: a snapshot status, or one of the two "nothing to fetch" states. */
export type ActivityStatus = SnapshotStatus | "NO_REPO" | "INVALID_REPO";

export interface RepoInfo {
  readonly full_name: string;
  readonly url: string;
  readonly default_branch: string;
  readonly description: string | null;
  readonly stars: number;
  /** GitHub counts open pull requests in this number. */
  readonly open_issues: number;
  readonly pushed_at: string | null;
}

export interface Contributor {
  readonly login: string;
  readonly avatar_url: string;
  readonly profile_url: string;
  readonly commits: number;
  readonly additions: number;
  readonly deletions: number;
  readonly last_commit_at: string | null;
}

export interface WeeklyCommits {
  readonly week_start: string;
  readonly commits: number;
}

export interface RecentCommit {
  readonly sha: string;
  readonly message: string;
  readonly author_login: string | null;
  readonly author_name: string;
  readonly committed_at: string;
  readonly url: string;
}

export interface ActivityData {
  readonly repo: RepoInfo;
  /** GitHub is still computing contributor statistics; ask again shortly. */
  readonly stats_pending: boolean;
  readonly totals: {
    readonly commits: number;
    readonly commits_last_30d: number;
    readonly contributors: number;
    readonly last_commit_at: string | null;
  };
  readonly contributors: readonly Contributor[];
  readonly weekly: readonly WeeklyCommits[];
  readonly recent_commits: readonly RecentCommit[];
}

export interface SnapshotRow {
  readonly project_id: string;
  readonly repo_full_name: string;
  readonly status: SnapshotStatus;
  readonly data: ActivityData | null;
  readonly fetched_at: string;
}

export interface GithubActivity {
  readonly status: ActivityStatus;
  readonly repo_full_name: string | null;
  readonly fetched_at: string | null;
  readonly data: ActivityData | null;
}

export type FetchResult =
  | { readonly ok: true; readonly data: ActivityData }
  | { readonly ok: false; readonly status: Exclude<SnapshotStatus, "OK"> };

/** Member-side access check, handed in by server.ts (the portal owns the rule). */
export interface GithubDependencies {
  readonly memberCanView: (
    actorId: string,
    projectId: string,
  ) => Promise<boolean>;
}

export interface GithubOptions {
  readonly token?: string;
  readonly internalSecret?: string;
  /** How long an OK snapshot is served before the next read refreshes it. */
  readonly staleMinutes?: number;
}
