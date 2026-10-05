-- Member portal (FR-PRT-01/02). Apply after files.schema.sql.
-- Owner: portal. Read-only functions; they read projects, project_members, roster_members,
-- semesters and project_resources by SQL (same precedent as files.member_get_project_file).
-- No rows = not found / not allowed, so callers can answer unknown and unauthorized alike (D-09).
BEGIN;

-- Eligible member = active app user + ACTIVE roster entry in the current semester (I-15).
CREATE OR REPLACE FUNCTION public.member_eligibility(p_actor_id uuid)
RETURNS TABLE (semester_id uuid, roster_member_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.id, rm.id
    FROM public.app_users u
    JOIN public.semesters s ON s.is_current
    JOIN public.roster_members rm ON rm.user_id = u.id AND rm.semester_id = s.id AND rm.status = 'ACTIVE'
   WHERE u.id = p_actor_id AND u.is_active;
$$;

-- The single access predicate for the portal: non-archived projects the actor is actively
-- assigned to. p_include_past widens it from the current semester to every semester in which
-- the actor had an ACTIVE roster entry and a live assignment (read-only history, D-05 flag).
CREATE OR REPLACE FUNCTION public.member_list_projects(p_actor_id uuid, p_include_past boolean DEFAULT false)
RETURNS TABLE (
  id uuid, name text, type text, description text,
  semester_id uuid, semester_name text, is_current boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, p.name::text, p.type, p.description, s.id, s.name::text, s.is_current
    FROM public.app_users u
    JOIN public.roster_members rm ON rm.user_id = u.id AND rm.status = 'ACTIVE'
    JOIN public.semesters s ON s.id = rm.semester_id AND (s.is_current OR p_include_past)
    JOIN public.project_members pm ON pm.roster_member_id = rm.id AND pm.removed_at IS NULL
    JOIN public.projects p ON p.id = pm.project_id AND p.archived_at IS NULL
   WHERE u.id = p_actor_id AND u.is_active
     -- past semesters are only visible to someone who is still eligible today
     AND (s.is_current OR EXISTS (SELECT 1 FROM public.member_eligibility(p_actor_id)))
   ORDER BY s.is_current DESC, p.name, p.id;
$$;

CREATE OR REPLACE FUNCTION public.member_get_project(p_actor_id uuid, p_project_id uuid, p_include_past boolean DEFAULT false)
RETURNS TABLE (
  id uuid, name text, type text, description text,
  semester_id uuid, semester_name text, is_current boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT * FROM public.member_list_projects(p_actor_id, p_include_past) l WHERE l.id = p_project_id;
$$;

-- Names only (D-10): never emails. Empty unless the actor can see the project.
CREATE OR REPLACE FUNCTION public.member_project_teammates(p_actor_id uuid, p_project_id uuid, p_include_past boolean DEFAULT false)
RETURNS TABLE (full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT rm.full_name::text
    FROM public.member_get_project(p_actor_id, p_project_id, p_include_past) mine
    JOIN public.project_members pm ON pm.project_id = mine.id AND pm.removed_at IS NULL
    JOIN public.roster_members rm ON rm.id = pm.roster_member_id AND rm.status = 'ACTIVE'
   ORDER BY rm.full_name, rm.id;
$$;

-- Notifications badge: resources of the actor's current projects changed since p_since.
CREATE OR REPLACE FUNCTION public.member_recent_resource_count(p_actor_id uuid, p_since timestamptz)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT count(*)
    FROM public.member_list_projects(p_actor_id, false) mine
    JOIN public.project_resources r ON r.project_id = mine.id
   WHERE r.updated_at >= p_since;
$$;

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.member_eligibility(uuid)',
    'public.member_list_projects(uuid, boolean)',
    'public.member_get_project(uuid, uuid, boolean)',
    'public.member_project_teammates(uuid, uuid, boolean)',
    'public.member_recent_resource_count(uuid, timestamptz)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
