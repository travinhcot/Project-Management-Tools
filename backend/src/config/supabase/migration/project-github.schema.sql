-- GitHub activity per project. Apply after project-resources.schema.sql.
-- Owner: github. One cached snapshot per project, built from the project's GITHUB_REPO link
-- by the backend (GitHub REST API). Written and read only by the service role.
BEGIN;

CREATE TABLE public.project_github_snapshots (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  repo_full_name text NOT NULL,            -- owner/repo the snapshot was built from
  status text NOT NULL CHECK (status IN
    ('OK', 'NOT_FOUND', 'NO_ACCESS', 'RATE_LIMITED', 'ERROR')),
  data jsonb,                              -- repo, totals, contributors, weekly, recent commits
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_github_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.project_github_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_github_snapshots TO service_role;

COMMIT;
