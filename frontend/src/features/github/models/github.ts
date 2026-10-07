/** Who is looking: picks the backend route (admins see any project, members only their own). */
export type GithubAudience = "admin" | "member";

export type GithubStatus =
  | "OK"
  | "NO_REPO"
  | "INVALID_REPO"
  | "NOT_FOUND"
  | "NO_ACCESS"
  | "RATE_LIMITED"
  | "ERROR";

export interface GithubContributor {
  login: string;
  avatarUrl: string;
  profileUrl: string;
  commits: number;
  additions: number;
  deletions: number;
  lastCommitAt: string | null;
}

export interface GithubCommit {
  sha: string;
  message: string;
  authorLogin: string | null;
  authorName: string;
  committedAt: string;
  url: string;
}

export interface GithubWeek {
  weekStart: string;
  commits: number;
}

export interface GithubRepo {
  fullName: string;
  url: string;
  defaultBranch: string;
  description: string | null;
  stars: number;
  openIssues: number;
  pushedAt: string | null;
}

export interface GithubActivity {
  status: GithubStatus;
  fetchedAt: string | null;
  repo: GithubRepo | null;
  /** GitHub is still computing contributor statistics. */
  statsPending: boolean;
  totalCommits: number;
  commitsLast30Days: number;
  lastCommitAt: string | null;
  contributors: GithubContributor[];
  weekly: GithubWeek[];
  recentCommits: GithubCommit[];
}
