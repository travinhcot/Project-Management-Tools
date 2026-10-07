-- Member portal view: leader name and head count per project, the member's own profile,
-- and the semesters they have access to. Apply after portal-project-details.schema.sql and
-- roster-department-birth-year.schema.sql. Read-only; same access predicate as the portal.
BEGIN;

-- Leader name + active head count for every project the actor can see. Names only (D-10).
CREATE FUNCTION public.member_project_summaries(p_actor_id uuid, p_include_past boolean DEFAULT false)
RETURNS TABLE (project_id uuid, leader_name text, member_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT mine.id,
         (SELECT rm.full_name::text
            FROM public.project_members pm
            JOIN public.roster_members rm ON rm.id = pm.roster_member_id AND rm.status = 'ACTIVE'
           WHERE pm.project_id = mine.id AND pm.removed_at IS NULL AND pm.role = 'LEADER'
           ORDER BY rm.full_name, rm.id
           LIMIT 1),
         (SELECT count(*)::integer
            FROM public.project_members pm
            JOIN public.roster_members rm ON rm.id = pm.roster_member_id AND rm.status = 'ACTIVE'
           WHERE pm.project_id = mine.id AND pm.removed_at IS NULL)
    FROM public.member_list_projects(p_actor_id, p_include_past) mine;
$$;

-- The actor's own details. Works for a signed-in user who is not on the roster (department
-- is then null), so the "no access" page can show the email they used.
CREATE FUNCTION public.member_profile(p_actor_id uuid)
RETURNS TABLE (full_name text, email text, department text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.full_name::text, u.email::text, rm.department::text
    FROM public.app_users u
    LEFT JOIN public.semesters s ON s.is_current
    LEFT JOIN public.roster_members rm
           ON rm.user_id = u.id AND rm.semester_id = s.id AND rm.status = 'ACTIVE'
   WHERE u.id = p_actor_id AND u.is_active;
$$;

-- Semesters in which the actor has an ACTIVE roster entry, with their live project count.
CREATE FUNCTION public.member_semesters(p_actor_id uuid)
RETURNS TABLE (semester_id uuid, name text, is_current boolean, ends_on date, project_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.id, s.name::text, s.is_current, s.ends_on, count(p.id)::integer
    FROM public.app_users u
    JOIN public.roster_members rm ON rm.user_id = u.id AND rm.status = 'ACTIVE'
    JOIN public.semesters s ON s.id = rm.semester_id
    LEFT JOIN public.project_members pm ON pm.roster_member_id = rm.id AND pm.removed_at IS NULL
    LEFT JOIN public.projects p ON p.id = pm.project_id AND p.archived_at IS NULL
   WHERE u.id = p_actor_id AND u.is_active
   GROUP BY s.id, s.name, s.is_current, s.ends_on, s.year, s.term
   ORDER BY s.is_current DESC, s.year DESC, s.term DESC;
$$;

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.member_project_summaries(uuid, boolean)',
    'public.member_profile(uuid)',
    'public.member_semesters(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
