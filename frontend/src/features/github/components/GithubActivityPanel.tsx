"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/shared/components/Button";
import { Pill } from "@/shared/components/Pill";
import { loadGithubActivity } from "@/features/github/actions";
import type {
  GithubActivity,
  GithubAudience,
  GithubContributor,
  GithubStatus,
  GithubWeek,
} from "@/features/github/models/github";
import { compact, timeAgo } from "@/features/github/utils/format";

const POLL_MS = 6000;
const MAX_POLLS = 6;

const MESSAGES: Record<Exclude<GithubStatus, "OK">, { admin: string; member: string }> = {
  NO_REPO: {
    admin: "No GitHub repository link yet. Add one with the “GitHub repo” tile on the project.",
    member: "Your admin hasn’t shared a GitHub repository for this project yet.",
  },
  INVALID_REPO: {
    admin: "The saved link is not a github.com/owner/repo address. Fix it with the “GitHub repo” tile.",
    member: "The shared GitHub link isn’t a valid repository address. Ask your admin to fix it.",
  },
  NOT_FOUND: {
    admin: "GitHub can’t find this repository. It may be misspelled, deleted, or private without access for the server’s token.",
    member: "GitHub can’t find this repository. Ask your admin to check the link.",
  },
  NO_ACCESS: {
    admin: "GitHub refused access to this repository. Check the server’s GITHUB_TOKEN permissions.",
    member: "GitHub refused access to this repository. Ask your admin to check it.",
  },
  RATE_LIMITED: {
    admin: "GitHub’s request limit was reached. Numbers will refresh automatically; try again in a few minutes.",
    member: "GitHub’s request limit was reached. Try again in a few minutes.",
  },
  ERROR: {
    admin: "GitHub could not be reached. Try refreshing in a moment.",
    member: "GitHub could not be reached. Try again in a moment.",
  },
};

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-chrome px-3.5 py-3">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className="break-words text-lg font-semibold text-ink">{value}</p>
      {note && <p className="break-words text-[11px] text-muted">{note}</p>}
    </div>
  );
}

function Leaderboard({ contributors }: { contributors: GithubContributor[] }) {
  const top = contributors[0]?.commits ?? 0;
  const total = contributors.reduce((sum, c) => sum + c.commits, 0);
  return (
    <ol className="flex flex-col gap-2">
      {contributors.map((c, index) => (
        <li key={c.login} className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={c.avatarUrl}
            alt=""
            width={30}
            height={30}
            className="size-[30px] shrink-0 rounded-full bg-chrome"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <a
                href={c.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-[13px] font-semibold text-ink hover:text-accent"
              >
                {c.login}
              </a>
              {index === 0 && contributors.length > 1 && <Pill tone="warn" size="sm">Top contributor</Pill>}
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-chrome"
              role="img"
              aria-label={`${c.commits} of ${total} commits`}
            >
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${top ? Math.max(3, (c.commits / top) * 100) : 0}%` }}
              />
            </div>
            <p className="text-[11px] text-muted">
              {Math.round((c.commits / total) * 100)}% ·{" "}
              <span className="text-success">+{compact(c.additions)}</span>{" "}
              <span className="text-danger">−{compact(c.deletions)}</span>
              {c.lastCommitAt && <> · last active {timeAgo(c.lastCommitAt)}</>}
            </p>
          </div>
          <p className="shrink-0 text-sm font-semibold text-ink">{c.commits}</p>
        </li>
      ))}
    </ol>
  );
}

function WeeklyChart({ weeks }: { weeks: GithubWeek[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.commits));
  return (
    <div>
      <div className="flex h-24 items-end gap-1" role="img" aria-label="Commits per week, last 12 weeks">
        {weeks.map((week) => (
          <div
            key={week.weekStart}
            title={`Week of ${week.weekStart.slice(0, 10)}: ${week.commits} commits`}
            className="flex h-full min-w-0 flex-1 items-end"
          >
            <div
              className={`w-full rounded-t-sm ${week.commits ? "bg-accent" : "bg-chrome"}`}
              style={{ height: week.commits ? `${Math.max(6, (week.commits / max) * 100)}%` : "3px" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>12 weeks ago</span>
        <span>This week</span>
      </div>
    </div>
  );
}

function Body({ activity }: { activity: GithubActivity }) {
  const { repo } = activity;
  if (!repo) return null;
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 @xl:grid-cols-4">
        <Stat label="Total commits" value={activity.statsPending ? "…" : compact(activity.totalCommits)} />
        <Stat label="Last 30 days" value={activity.statsPending ? "…" : String(activity.commitsLast30Days)} />
        <Stat
          label="Last commit"
          value={activity.lastCommitAt ? timeAgo(activity.lastCommitAt) : "—"}
        />
        <Stat label="Open issues & PRs" value={String(repo.openIssues)} note={`Branch ${repo.defaultBranch}`} />
      </div>

      {activity.statsPending && (
        <p className="rounded-lg bg-chrome px-3 py-2 text-xs text-muted" role="status">
          GitHub is still calculating contributor statistics for this repository. This page will
          update on its own.
        </p>
      )}

      {activity.contributors.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h3 className="text-sm font-semibold text-ink">
            Contributors · {activity.contributors.length}
          </h3>
          <Leaderboard contributors={activity.contributors} />
        </section>
      )}

      {activity.weekly.some((w) => w.commits > 0) && (
        <section className="flex flex-col gap-2.5">
          <h3 className="text-sm font-semibold text-ink">Commits per week</h3>
          <WeeklyChart weeks={activity.weekly} />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">Recent commits</h3>
        {activity.recentCommits.length === 0 ? (
          <p className="text-xs text-muted">No commits yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {activity.recentCommits.map((commit) => (
              <li key={commit.sha} className="rounded-lg bg-chrome px-3 py-2">
                <a
                  href={commit.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-words text-[13px] font-medium text-ink hover:text-accent"
                >
                  {commit.message || "(no message)"}
                </a>
                <p className="break-words text-[11px] text-muted">
                  {commit.authorLogin ?? commit.authorName} · {timeAgo(commit.committedAt)} ·{" "}
                  <span className="font-mono">{commit.sha.slice(0, 7)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** Commit activity of a project's GitHub repository, loaded when it mounts. */
export function GithubActivityPanel({
  projectId,
  audience,
  framed = true,
}: {
  projectId: string;
  audience: GithubAudience;
  /** false inside a drawer, which is already a card. */
  framed?: boolean;
}) {
  const [activity, setActivity] = useState<GithubActivity>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const polls = useRef(0);

  const load = useCallback(
    async (refresh: boolean) => {
      setBusy(true);
      const result = await loadGithubActivity(audience, projectId, refresh);
      if (result.ok) {
        setActivity(result.activity);
        setError(undefined);
      } else setError(result.message);
      setBusy(false);
    },
    [audience, projectId],
  );

  useEffect(() => {
    let cancelled = false;
    loadGithubActivity(audience, projectId).then((result) => {
      if (cancelled) return;
      if (result.ok) setActivity(result.activity);
      else setError(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, [audience, projectId]);

  // GitHub computes contributor statistics in the background; ask again a few times.
  const pending = activity?.statsPending ?? false;
  useEffect(() => {
    if (!pending || polls.current >= MAX_POLLS) return;
    const timer = setTimeout(() => {
      polls.current += 1;
      load(false);
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [pending, activity, load]);

  return (
    <section
      className={`@container flex min-w-0 flex-col gap-4 ${framed ? "rounded-2xl bg-surface p-5 shadow-card" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className={`font-semibold text-ink ${framed ? "text-xl" : "sr-only"}`}>GitHub activity</h2>
          {activity?.repo && (
            <a
              href={activity.repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-xs font-medium text-accent hover:underline"
            >
              {activity.repo.fullName}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {activity?.fetchedAt && (
            <span className="text-[11px] text-muted">Updated {timeAgo(activity.fetchedAt)}</span>
          )}
          {audience === "admin" && activity && activity.status !== "NO_REPO" && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                polls.current = 0;
                load(true);
              }}
            >
              {busy ? "Refreshing…" : "Refresh"}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger-text" role="alert">
          {error}
        </p>
      )}
      {!activity && !error && <p className="text-xs text-muted">Loading GitHub activity…</p>}

      {activity &&
        (activity.status === "OK" ? (
          <Body activity={activity} />
        ) : (
          <>
            <p className="rounded-lg bg-chrome px-3 py-2.5 text-xs text-muted">
              {MESSAGES[activity.status][audience]}
            </p>
            {/* A failed refresh keeps the last good numbers; show them under the notice. */}
            {activity.repo && <Body activity={activity} />}
          </>
        ))}
    </section>
  );
}
