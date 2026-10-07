// Reads GitHub activity from the backend (GET /api/admin/projects/:id/github or
// GET /api/me/projects/:id/github). Server-only: it goes through backendFetch.
import { backendFetch } from "@/shared/api/backend";
import type { GithubActivity, GithubAudience, GithubStatus } from "@/features/github/models/github";

/** GithubActivity in backend/src/modules/github/model/github.model.ts. */
interface ActivityDto {
  status: GithubStatus;
  fetched_at: string | null;
  data: {
    repo: {
      full_name: string;
      url: string;
      default_branch: string;
      description: string | null;
      stars: number;
      open_issues: number;
      pushed_at: string | null;
    };
    stats_pending: boolean;
    totals: {
      commits: number;
      commits_last_30d: number;
      last_commit_at: string | null;
    };
    contributors: {
      login: string;
      avatar_url: string;
      profile_url: string;
      commits: number;
      additions: number;
      deletions: number;
      last_commit_at: string | null;
    }[];
    weekly: { week_start: string; commits: number }[];
    recent_commits: {
      sha: string;
      message: string;
      author_login: string | null;
      author_name: string;
      committed_at: string;
      url: string;
    }[];
  } | null;
}

function mapActivity({ status, fetched_at, data }: ActivityDto): GithubActivity {
  return {
    status,
    fetchedAt: fetched_at,
    repo: data && {
      fullName: data.repo.full_name,
      url: data.repo.url,
      defaultBranch: data.repo.default_branch,
      description: data.repo.description,
      stars: data.repo.stars,
      openIssues: data.repo.open_issues,
      pushedAt: data.repo.pushed_at,
    },
    statsPending: data?.stats_pending ?? false,
    totalCommits: data?.totals.commits ?? 0,
    commitsLast30Days: data?.totals.commits_last_30d ?? 0,
    lastCommitAt: data?.totals.last_commit_at ?? null,
    contributors: (data?.contributors ?? []).map((c) => ({
      login: c.login,
      avatarUrl: c.avatar_url,
      profileUrl: c.profile_url,
      commits: c.commits,
      additions: c.additions,
      deletions: c.deletions,
      lastCommitAt: c.last_commit_at,
    })),
    weekly: (data?.weekly ?? []).map((w) => ({ weekStart: w.week_start, commits: w.commits })),
    recentCommits: (data?.recent_commits ?? []).map((c) => ({
      sha: c.sha,
      message: c.message,
      authorLogin: c.author_login,
      authorName: c.author_name,
      committedAt: c.committed_at,
      url: c.url,
    })),
  };
}

export async function fetchGithubActivity(
  audience: GithubAudience,
  projectId: string,
  refresh: boolean,
): Promise<GithubActivity> {
  const base = audience === "admin" ? "/api/admin/projects" : "/api/me/projects";
  const path = `${base}/${projectId}/github`;
  // Only admins can force a refresh; members read the cached snapshot (it refreshes itself).
  const forced = refresh && audience === "admin";
  const { activity } = await backendFetch<{ activity: ActivityDto }>(
    forced ? `${path}/refresh` : path,
    { method: forced ? "POST" : "GET" },
  );
  return mapActivity(activity);
}
