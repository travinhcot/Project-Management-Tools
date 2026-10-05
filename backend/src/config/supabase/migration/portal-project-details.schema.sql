-- Member portal: project status, kick-off date and teammate roles.
-- Apply after portal.schema.sql, project-status.schema.sql, project-leader.schema.sql, emails.schema.sql.
-- Same access predicate as before; only extra columns are exposed. Names only for teammates (D-10).
BEGIN;

DROP FUNCTION public.member_project_teammates(uuid, uuid, boolean);
DROP FUNCTION public.member_get_project(uuid, uuid, boolean);
DROP FUNCTION public.member_list_projects(uuid, boolean);

-- kickoff_at: the latest kick-off that is not cancelled and not a draft (members never see drafts).
CREATE FUNCTION public.member_list_projects(p_actor_id uuid, p_include_past boolean DEFAULT false)
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
    LEFT JOIN LATERAL (
      SELECT c.scheduled_at
        FROM public.email_campaigns c
       WHERE c.project_id = p.id AND c.kind = 'KICKOFF'
         AND c.status IN ('SCHEDULED', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_FAILURES')
       ORDER BY c.scheduled_at DESC
       LIMIT 1) k ON true
   WHERE u.id = p_actor_id AND u.is_active
     -- past semesters are only visible to someone who is still eligible today
     AND (s.is_current OR EXISTS (SELECT 1 FROM public.member_eligibility(p_actor_id)))
   ORDER BY s.is_current DESC, p.name, p.id;
$$;

CREATE FUNCTION public.member_get_project(p_actor_id uuid, p_project_id uuid, p_include_past boolean DEFAULT false)
RETURNS TABLE (
  id uuid, name text, type text, description text,
  semester_id uuid, semester_name text, is_current boolean,
  status text, kickoff_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT * FROM public.member_list_projects(p_actor_id, p_include_past) l WHERE l.id = p_project_id;
$$;

-- Names and role only: never emails. Leader first. Empty unless the actor can see the project.
CREATE FUNCTION public.member_project_teammates(p_actor_id uuid, p_project_id uuid, p_include_past boolean DEFAULT false)
RETURNS TABLE (full_name text, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT rm.full_name::text, pm.role
    FROM public.member_get_project(p_actor_id, p_project_id, p_include_past) mine
    JOIN public.project_members pm ON pm.project_id = mine.id AND pm.removed_at IS NULL
    JOIN public.roster_members rm ON rm.id = pm.roster_member_id AND rm.status = 'ACTIVE'
   ORDER BY (pm.role = 'LEADER') DESC, rm.full_name, rm.id;
$$;

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.member_list_projects(uuid, boolean)',
    'public.member_get_project(uuid, uuid, boolean)',
    'public.member_project_teammates(uuid, uuid, boolean)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
