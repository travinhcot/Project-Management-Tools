import type { GithubRepoRef } from "../common/github-url.ts";
import type {
  ActivityData,
  Contributor,
  FetchResult,
  RecentCommit,
  RepoInfo,
  WeeklyCommits,
} from "../model/github.model.ts";

const API = "https://api.github.com";
const WEEKS_SHOWN = 12;
const WEEK_SECONDS = 7 * 24 * 3600;

interface Reply {
  readonly status: number;
  readonly rateLimited: boolean;
  readonly body: unknown;
}

interface StatsEntry {
  total: number;
  weeks: { w: number; a: number; d: number; c: number }[];
  author: { login: string; avatar_url: string; html_url: string } | null;
}

interface CommitItem {
  sha: string;
  html_url: string;
  author: { login: string } | null;
  commit: {
    message?: string;
    author?: { name?: string; date?: string };
    committer?: { date?: string };
  };
}

const iso = (seconds: number) => new Date(seconds * 1000).toISOString();

export function createGithubProvider(token: string | undefined) {
  async function get(path: string): Promise<Reply> {
    const response = await fetch(`${API}${path}`, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "project-management-tools",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const rateLimited =
      response.headers.get("x-ratelimit-remaining") === "0" ||
      response.status === 429;
    const body: unknown =
      response.status === 204 ? null : await response.json().catch(() => null);
    return { status: response.status, rateLimited, body };
  }

  function failure(reply: Reply): FetchResult {
    if (reply.rateLimited) return { ok: false, status: "RATE_LIMITED" };
    if (reply.status === 404) return { ok: false, status: "NOT_FOUND" };
    if (reply.status === 401 || reply.status === 403)
      return { ok: false, status: "NO_ACCESS" };
    return { ok: false, status: "ERROR" };
  }

  function toRepo(body: Record<string, unknown>): RepoInfo {
    return {
      full_name: String(body.full_name),
      url: String(body.html_url),
      default_branch: String(body.default_branch ?? "main"),
      description: (body.description as string | null) ?? null,
      stars: Number(body.stargazers_count ?? 0),
      open_issues: Number(body.open_issues_count ?? 0),
      pushed_at: (body.pushed_at as string | null) ?? null,
    };
  }

  function toRecent(body: unknown): RecentCommit[] {
    if (!Array.isArray(body)) return [];
    return (body as CommitItem[]).map((item) => ({
      sha: String(item.sha),
      message: String(item.commit?.message ?? "").split("\n")[0].slice(0, 200),
      author_login: item.author?.login ?? null,
      author_name: String(item.commit?.author?.name ?? "Unknown"),
      committed_at: String(
        item.commit?.author?.date ?? item.commit?.committer?.date ?? "",
      ),
      url: String(item.html_url),
    }));
  }

  /** Per-author totals and weekly buckets from /stats/contributors. */
  function fromStats(entries: StatsEntry[], nowSeconds: number) {
    const weekly = new Map<number, number>();
    const contributors: Contributor[] = [];
    let commitsLast30d = 0;
    for (const entry of entries) {
      let additions = 0;
      let deletions = 0;
      let lastWeek = 0;
      for (const week of entry.weeks) {
        additions += week.a;
        deletions += week.d;
        if (week.c > 0) {
          lastWeek = Math.max(lastWeek, week.w);
          weekly.set(week.w, (weekly.get(week.w) ?? 0) + week.c);
          if (week.w + WEEK_SECONDS > nowSeconds - 30 * 24 * 3600)
            commitsLast30d += week.c;
        }
      }
      if (!entry.author || entry.total === 0) continue;
      contributors.push({
        login: entry.author.login,
        avatar_url: entry.author.avatar_url,
        profile_url: entry.author.html_url,
        commits: entry.total,
        additions,
        deletions,
        last_commit_at: lastWeek ? iso(lastWeek) : null,
      });
    }
    contributors.sort((a, b) => b.commits - a.commits);
    // GitHub weeks start on Sunday; anchor the chart on the newest week we know of.
    const lastKnown = Math.max(0, ...weekly.keys());
    const end = Math.max(lastKnown, nowSeconds - (nowSeconds % WEEK_SECONDS));
    const series: WeeklyCommits[] = [];
    for (let i = WEEKS_SHOWN - 1; i >= 0; i--) {
      const start = end - i * WEEK_SECONDS;
      series.push({ week_start: iso(start), commits: weekly.get(start) ?? 0 });
    }
    return { contributors, weekly: series, commitsLast30d };
  }

  return {
    async fetchActivity(ref: GithubRepoRef): Promise<FetchResult> {
      const base = `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`;
      const repoReply = await get(base);
      if (repoReply.status !== 200 || !repoReply.body)
        return failure(repoReply);
      const repo = toRepo(repoReply.body as Record<string, unknown>);

      const [commitsReply, statsReply] = await Promise.all([
        get(`${base}/commits?per_page=15`),
        get(`${base}/stats/contributors`),
      ]);
      if (commitsReply.rateLimited || statsReply.rateLimited)
        return { ok: false, status: "RATE_LIMITED" };

      const recent =
        commitsReply.status === 200 ? toRecent(commitsReply.body) : [];
      const entries =
        statsReply.status === 200 && Array.isArray(statsReply.body)
          ? (statsReply.body as StatsEntry[])
          : [];
      const stats = fromStats(entries, Math.floor(Date.now() / 1000));

      const data: ActivityData = {
        repo,
        stats_pending: statsReply.status === 202,
        totals: {
          commits: stats.contributors.reduce((sum, c) => sum + c.commits, 0),
          commits_last_30d: stats.commitsLast30d,
          contributors: stats.contributors.length,
          last_commit_at: recent[0]?.committed_at ?? repo.pushed_at,
        },
        contributors: stats.contributors,
        weekly: stats.weekly,
        recent_commits: recent,
      };
      return { ok: true, data };
    },
  };
}

export type GithubProvider = ReturnType<typeof createGithubProvider>;
