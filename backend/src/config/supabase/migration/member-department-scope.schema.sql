-- Member portal department separation. Apply after marcom-workflow.schema.sql.
--
-- A member only ever sees projects of their own roster department (roster_members.department_id).
--   1. member_list_projects joins on the department; member_get_project, member_project_teammates,
--      member_project_summaries and member_recent_resource_count derive from it, so they follow.
--   2. member_get_project_file and member_assert_assigned (final-package upload) get the same predicate.
--   3. A trigger refuses assigning a member to a project of another department (ADMIN included).
--
-- PRE-FLIGHT (run first, fix the data, then apply): active assignments that cross departments
-- stop being visible to the member once this is applied, and block step 3.
--
--   SELECT pm.id, rm.full_name, rd.code AS member_department, pd.code AS project_department, p.name
--     FROM public.project_members pm
--     JOIN public.roster_members rm ON rm.id = pm.roster_member_id
--     JOIN public.projects p ON p.id = pm.project_id
--     LEFT JOIN public.departments rd ON rd.id = rm.department_id
--     LEFT JOIN public.departments pd ON pd.id = p.department_id
--    WHERE pm.removed_at IS NULL AND rm.department_id IS DISTINCT FROM p.department_id;
BEGIN;

-- =============================================================================
-- 1. Member project list (same signature and columns: dependents keep working)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.member_list_projects(p_actor_id uuid, p_include_past boolean DEFAULT false)
RETURNS TABLE (
  id uuid, name text, type text, description text,
  semester_id uuid, semester_name text, is_current boolean,
  status text, kickoff_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, p.name::text, p.type, p.description, s.id, s.name::text, s.is_current,
         p.status, k.scheduled_at
    FROM public.app_users u
    JOIN public.roster_members rm ON rm.user_id = u.id AND rm.status = 'ACTIVE'
    JOIN public.semesters s ON s.id = rm.semester_id AND (s.is_current OR p_include_past)
    JOIN public.project_members pm ON pm.roster_member_id = rm.id AND pm.removed_at IS NULL
    JOIN public.projects p ON p.id = pm.project_id AND p.archived_at IS NULL
                          AND p.department_id = rm.department_id
    LEFT JOIN LATERAL (
      SELECT c.scheduled_at
        FROM public.email_campaigns c
       WHERE c.project_id = p.id AND c.kind = 'KICKOFF'
         AND c.status IN ('SCHEDULED', 'PROCESSING', 'COMPLETED', 'FAILED')
       ORDER BY c.scheduled_at DESC
       LIMIT 1) k ON true
   WHERE u.id = p_actor_id AND u.is_active
     -- past semesters are only visible to someone who is still eligible today
     AND (s.is_current OR EXISTS (SELECT 1 FROM public.member_eligibility(p_actor_id)))
   ORDER BY s.is_current DESC, p.name, p.id;
$$;

-- =============================================================================
-- 2. File download and final-package upload
-- =============================================================================
CREATE OR REPLACE FUNCTION public.member_get_project_file(p_actor_id uuid, p_project_id uuid, p_file_id uuid)
RETURNS TABLE (bucket_id text, object_path text, original_filename text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT f.bucket_id, f.object_path, f.original_filename
    FROM public.project_files f
    JOIN public.projects p ON p.id = f.project_id
    JOIN public.app_users u ON u.id = p_actor_id AND u.is_active
    JOIN public.semesters s ON s.is_current
    JOIN public.roster_members rm ON rm.user_id = u.id AND rm.semester_id = s.id AND rm.status = 'ACTIVE'
                                 AND rm.department_id = p.department_id
    JOIN public.project_members pm ON pm.roster_member_id = rm.id AND pm.project_id = f.project_id
                                  AND pm.removed_at IS NULL
   WHERE f.id = p_file_id AND f.project_id = p_project_id AND f.status = 'ACTIVE';
$$;

CREATE OR REPLACE FUNCTION public.member_assert_assigned(p_actor_id uuid, p_project_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_roster_member_id uuid;
BEGIN
  SELECT pm.roster_member_id INTO v_roster_member_id
    FROM public.member_eligibility(p_actor_id) e
    JOIN public.roster_members rm ON rm.id = e.roster_member_id
    JOIN public.project_members pm ON pm.roster_member_id = e.roster_member_id
                                  AND pm.project_id = p_project_id AND pm.removed_at IS NULL
    JOIN public.projects p ON p.id = pm.project_id AND p.semester_id = e.semester_id
                          AND p.department_id = rm.department_id;
  IF v_roster_member_id IS NULL THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_roster_member_id;
END;
$$;

-- =============================================================================
-- 3. No cross-department assignment
-- =============================================================================
CREATE FUNCTION public.project_members_department_match()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_project uuid; v_member uuid;
BEGIN
  SELECT department_id INTO v_project FROM public.projects WHERE id = NEW.project_id;
  SELECT department_id INTO v_member FROM public.roster_members WHERE id = NEW.roster_member_id;
  IF v_project IS DISTINCT FROM v_member THEN
    RAISE EXCEPTION 'DEPARTMENT_MISMATCH' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
-- Only new or re-pointed assignments are checked; removing a member (UPDATE of removed_at) stays allowed.
CREATE TRIGGER project_members_department_match
BEFORE INSERT OR UPDATE OF project_id, roster_member_id ON public.project_members
FOR EACH ROW EXECUTE FUNCTION public.project_members_department_match();

REVOKE ALL ON FUNCTION public.project_members_department_match() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_list_projects(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_get_project_file(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_assert_assigned(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_list_projects(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_get_project_file(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_assert_assigned(uuid, uuid) TO service_role;

COMMIT;
