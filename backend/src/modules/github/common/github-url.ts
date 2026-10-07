export interface GithubRepoRef {
  readonly owner: string;
  readonly repo: string;
  readonly fullName: string;
}

const SEGMENT = /^[A-Za-z0-9._-]{1,100}$/;

/** https://github.com/owner/repo[.git][/anything] -> owner/repo; any other host or shape -> null. */
export function parseGithubRepoUrl(url: string): GithubRepoRef | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (parsed.hostname !== "github.com" && parsed.hostname !== "www.github.com")
    return null;
  const [owner, rawRepo] = parsed.pathname.split("/").filter(Boolean);
  if (!owner || !rawRepo) return null;
  const repo = rawRepo.replace(/\.git$/, "");
  if (!SEGMENT.test(owner) || !SEGMENT.test(repo) || repo === "." || repo === "..")
    return null;
  return { owner, repo, fullName: `${owner}/${repo}` };
}
