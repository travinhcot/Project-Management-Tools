-- Assignments (FR-ASG-01/02). Apply after projects.schema.sql.
-- Owner: projects. Reads roster_members (FK parent) and projects (own table).
BEGIN;

-- =============================================================================
-- 1. One guard trigger for project_members (replaces project_members_guard_archived)
--    INSERT: project not archived, roster entry ACTIVE.
--    UPDATE: only "remove" is allowed (removed_at/by from NULL to a value).
--            Identity columns and removed rows are immutable, so history can't be
--            rewritten and re-assigning always creates a new row.
-- =============================================================================
DROP TRIGGER project_members_guard_archived ON public.project_members;
DROP FUNCTION public.project_members_guard_archived();

CREATE FUNCTION public.project_members_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_archived timestamptz;
  v_status   text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.project_id          IS DISTINCT FROM OLD.project_id
       OR NEW.semester_id      IS DISTINCT FROM OLD.semester_id
       OR NEW.roster_member_id IS DISTINCT FROM OLD.roster_member_id
       OR NEW.added_by_user_id IS DISTINCT FROM OLD.added_by_user_id
       OR NEW.added_at         IS DISTINCT FROM OLD.added_at
       OR (OLD.removed_at IS NOT NULL
           AND (NEW.removed_at IS DISTINCT FROM OLD.removed_at
                OR NEW.removed_by_user_id IS DISTINCT FROM OLD.removed_by_user_id)) THEN
      RAISE EXCEPTION 'ASSIGNMENT_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;                     -- no-op updates (seed re-run) still pass
  END IF;

  -- INSERT. FOR SHARE serialises with archive (FOR UPDATE on projects)
  -- and with roster deactivation (FOR UPDATE on roster_members).
  SELECT archived_at INTO v_archived FROM public.projects WHERE id = NEW.project_id FOR SHARE;
  IF FOUND AND v_archived IS NOT NULL THEN
    RAISE EXCEPTION 'PROJECT_ARCHIVED' USING ERRCODE = 'P0001';
  END IF;
  SELECT status INTO v_status FROM public.roster_members WHERE id = NEW.roster_member_id FOR SHARE;
  IF FOUND AND v_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'ROSTER_MEMBER_INACTIVE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;                       -- missing parent rows -> 23503 from the FKs
END;
$$;
CREATE TRIGGER project_members_guard BEFORE INSERT OR UPDATE ON public.project_members
FOR EACH ROW EXECUTE FUNCTION public.project_members_guard();

-- =============================================================================
-- 2. Assign one or many (FR-ASG-01 / FR-ASG-02)
--    One transaction. Each id is checked on its own; valid ones are inserted,
--    invalid ones are returned with a reason. One audit event per request.
--    Returns: { "accepted": [{assignment_id, roster_member_id, added_at}],
--               "rejected": [{roster_member_id, reason}] }
-- =============================================================================
CREATE FUNCTION public.admin_assign_project_members(
  p_actor_id uuid, p_project_id uuid, p_roster_member_ids uuid[], p_request_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_project   public.projects;
  v_member    public.roster_members;
  v_id        uuid;
  v_new_id    uuid;
  v_added_at  timestamptz;
  v_reason    text;
  v_accepted  jsonb := '[]'::jsonb;
  v_rejected  jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  IF p_roster_member_ids IS NULL OR cardinality(p_roster_member_ids) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'INVALID_MEMBER_LIST' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_project.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'PROJECT_ARCHIVED' USING ERRCODE = 'P0001';
  END IF;

  -- Sorted, de-duplicated: locks are always taken in the same order (no deadlocks).
  FOR v_id IN SELECT DISTINCT x FROM unnest(p_roster_member_ids) AS x ORDER BY x LOOP
    v_reason := NULL;
    v_new_id := NULL;
    SELECT * INTO v_member FROM public.roster_members WHERE id = v_id FOR SHARE;
    IF NOT FOUND THEN
      v_reason := 'ROSTER_MEMBER_NOT_FOUND';
    ELSIF v_member.semester_id <> v_project.semester_id THEN
      v_reason := 'ROSTER_MEMBER_OTHER_SEMESTER';
    ELSIF v_member.status <> 'ACTIVE' THEN
      v_reason := 'ROSTER_MEMBER_INACTIVE';
    ELSE
      INSERT INTO public.project_members (project_id, semester_id, roster_member_id, added_by_user_id)
      VALUES (p_project_id, v_project.semester_id, v_id, p_actor_id)
      ON CONFLICT (project_id, roster_member_id) WHERE removed_at IS NULL DO NOTHING
      RETURNING id, added_at INTO v_new_id, v_added_at;      -- no row -> NULLs
      IF v_new_id IS NULL THEN
        v_reason := 'ALREADY_ASSIGNED';
      ELSE
        v_accepted := v_accepted || jsonb_build_object(
          'assignment_id', v_new_id, 'roster_member_id', v_id, 'added_at', v_added_at);
      END IF;
    END IF;
    IF v_reason IS NOT NULL THEN
      v_rejected := v_rejected || jsonb_build_object('roster_member_id', v_id, 'reason', v_reason);
    END IF;
  END LOOP;

  IF jsonb_array_length(v_accepted) > 0 THEN
    INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
    VALUES (p_actor_id, 'PROJECT_MEMBERS_ADDED', 'PROJECT', p_project_id,
            jsonb_build_object(
              'semester_id', v_project.semester_id,
              'roster_member_ids', (SELECT jsonb_agg(a->'roster_member_id') FROM jsonb_array_elements(v_accepted) a),
              'assignment_ids',    (SELECT jsonb_agg(a->'assignment_id')    FROM jsonb_array_elements(v_accepted) a),
              'rejected_count', jsonb_array_length(v_rejected)),
            p_request_id);
  END IF;

  RETURN jsonb_build_object('accepted', v_accepted, 'rejected', v_rejected);
END;
$$;

-- =============================================================================
-- 3. Remove (FR-ASG-01): soft delete of the ACTIVE assignment only.
-- =============================================================================
CREATE FUNCTION public.admin_remove_project_member(
  p_actor_id uuid, p_project_id uuid, p_roster_member_id uuid, p_request_id text
) RETURNS public.project_members
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.project_members;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  UPDATE public.project_members
     SET removed_at = now(), removed_by_user_id = p_actor_id
   WHERE project_id = p_project_id AND roster_member_id = p_roster_member_id
     AND removed_at IS NULL
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id) THEN
      RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND' USING ERRCODE = 'P0002';   -- also: concurrent second remove
  END IF;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'PROJECT_MEMBER_REMOVED', 'PROJECT', p_project_id,
          jsonb_build_object('semester_id', v_row.semester_id,
                             'roster_member_id', v_row.roster_member_id,
                             'assignment_id', v_row.id),
          p_request_id);
  RETURN v_row;
END;
$$;

-- =============================================================================
-- 4. Privileges: backend (service_role) only
-- =============================================================================
REVOKE ALL ON FUNCTION public.project_members_guard() FROM PUBLIC, anon, authenticated;
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.admin_assign_project_members(uuid, uuid, uuid[], text)',
    'public.admin_remove_project_member(uuid, uuid, uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
