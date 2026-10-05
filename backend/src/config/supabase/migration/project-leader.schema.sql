-- Project leader. Apply after project-status.schema.sql and project-members.schema.sql.
-- A project has at most one ACTIVE leader; everyone else on it is a MEMBER.
BEGIN;

ALTER TABLE public.project_members
  ADD COLUMN role text NOT NULL DEFAULT 'MEMBER'
    CONSTRAINT project_members_role_check CHECK (role IN ('LEADER', 'MEMBER'));

CREATE UNIQUE INDEX project_members_one_active_leader
  ON public.project_members (project_id)
  WHERE role = 'LEADER' AND removed_at IS NULL;

-- ---------- Set / clear the leader ----------
-- p_role = 'LEADER': promotes the person and demotes the current leader in one transaction.
-- p_role = 'MEMBER': demotes the person (the project is left without a leader).
-- The projects row is locked FOR UPDATE so two concurrent promotions serialise.
CREATE FUNCTION public.admin_set_project_member_role(
  p_actor_id uuid, p_project_id uuid, p_roster_member_id uuid, p_role text, p_request_id text
) RETURNS public.project_members
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_archived timestamptz;
  v_semester uuid;
  v_row      public.project_members;
  v_previous uuid;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  IF p_role IS NULL OR p_role NOT IN ('LEADER', 'MEMBER') THEN
    RAISE EXCEPTION 'INVALID_ROLE' USING ERRCODE = '22023';
  END IF;

  SELECT archived_at, semester_id INTO v_archived, v_semester
    FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_archived IS NOT NULL THEN RAISE EXCEPTION 'PROJECT_ARCHIVED' USING ERRCODE = 'P0001'; END IF;

  SELECT * INTO v_row FROM public.project_members
   WHERE project_id = p_project_id AND roster_member_id = p_roster_member_id AND removed_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  IF v_row.role = p_role THEN RETURN v_row; END IF;     -- no-op, no audit noise

  IF p_role = 'LEADER' THEN
    UPDATE public.project_members SET role = 'MEMBER'
     WHERE project_id = p_project_id AND role = 'LEADER' AND removed_at IS NULL
    RETURNING roster_member_id INTO v_previous;
  END IF;
  UPDATE public.project_members SET role = p_role WHERE id = v_row.id RETURNING * INTO v_row;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'PROJECT_MEMBER_ROLE_CHANGED', 'PROJECT', p_project_id,
          jsonb_strip_nulls(jsonb_build_object(
            'semester_id', v_semester,
            'roster_member_id', p_roster_member_id,
            'assignment_id', v_row.id,
            'role', p_role,
            'previous_leader_roster_member_id', v_previous)),
          p_request_id);
  RETURN v_row;
END;
$$;

-- ---------- List: leader columns, search also matches the leader's name ----------
DROP FUNCTION public.admin_list_projects(uuid, text, text, text, text, integer, integer);
CREATE FUNCTION public.admin_list_projects(
  p_semester_id uuid, p_search text, p_type text, p_status text, p_archived text,
  p_limit integer, p_offset integer
) RETURNS TABLE (
  id uuid, semester_id uuid, name varchar, description text, type text, status text,
  archived_at timestamptz, created_by_user_id uuid, created_at timestamptz, updated_at timestamptz,
  member_count bigint, leader_roster_member_id uuid, leader_name varchar, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.semester_id, p.name, p.description, p.type, p.status, p.archived_at,
         p.created_by_user_id, p.created_at, p.updated_at,
         (SELECT count(*) FROM public.project_members pm
           WHERE pm.project_id = p.id AND pm.removed_at IS NULL),
         l.roster_member_id, l.full_name,
         count(*) OVER ()
    FROM public.projects p
    LEFT JOIN LATERAL (
      SELECT pm.roster_member_id, rm.full_name
        FROM public.project_members pm
        JOIN public.roster_members rm ON rm.id = pm.roster_member_id
       WHERE pm.project_id = p.id AND pm.role = 'LEADER' AND pm.removed_at IS NULL
       LIMIT 1) l ON true
   WHERE p.semester_id = p_semester_id
     AND (p_search IS NULL
          OR strpos(lower(p.name), lower(p_search)) > 0
          OR strpos(lower(coalesce(l.full_name, '')), lower(p_search)) > 0)
     AND (p_type IS NULL OR p.type = p_type)
     AND (p_status IS NULL OR p.status = p_status)
     AND CASE coalesce(p_archived, 'exclude')
           WHEN 'exclude' THEN p.archived_at IS NULL
           WHEN 'only'    THEN p.archived_at IS NOT NULL
           ELSE true END
   ORDER BY lower(p.name), p.id
   LIMIT least(greatest(p_limit, 1), 100)
  OFFSET greatest(p_offset, 0);
END;
$$;

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.admin_set_project_member_role(uuid, uuid, uuid, text, text)',
    'public.admin_list_projects(uuid, text, text, text, text, integer, integer)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
