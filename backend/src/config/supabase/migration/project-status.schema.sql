-- Project status (Planning / Ongoing / Completed / Failed). Apply after projects.schema.sql.
-- Independent of archived_at: archiving hides a project, status describes how it went.
BEGIN;

ALTER TABLE public.projects
  ADD COLUMN status text NOT NULL DEFAULT 'PLANNING'
    CONSTRAINT projects_status_check CHECK (status IN ('PLANNING', 'ONGOING', 'COMPLETED', 'FAILED'));

-- ---------- Create: optional p_status (default PLANNING) ----------
DROP FUNCTION public.admin_create_project(uuid, uuid, text, text, text, text);
CREATE FUNCTION public.admin_create_project(
  p_actor_id uuid, p_semester_id uuid, p_name text, p_type text, p_description text,
  p_status text, p_request_id text
) RETURNS public.projects
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.projects;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  PERFORM public.project_lock_semester(p_semester_id);
  INSERT INTO public.projects (semester_id, name, type, description, status, created_by_user_id)
  VALUES (p_semester_id, btrim(p_name), p_type, nullif(btrim(p_description), ''),
          coalesce(p_status, 'PLANNING'), p_actor_id)
  RETURNING * INTO v_row;                                   -- same name in semester -> 23505

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'PROJECT_CREATED', 'PROJECT', v_row.id,
          jsonb_build_object('semester_id', v_row.semester_id, 'name', v_row.name,
                             'type', v_row.type, 'status', v_row.status),
          p_request_id);
  RETURN v_row;
END;
$$;

-- ---------- Update: p_changes may now include status ----------
CREATE OR REPLACE FUNCTION public.admin_update_project(
  p_actor_id uuid, p_project_id uuid, p_expected_updated_at timestamptz,
  p_changes jsonb, p_request_id text
) RETURNS public.projects
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_before public.projects;
  v_after  public.projects;
  v_target uuid;
  v_fields text[];
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_changes) k
                 WHERE k NOT IN ('name', 'description', 'type', 'semester_id', 'status')) THEN
    RAISE EXCEPTION 'NO_CHANGES' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_before.archived_at IS NOT NULL THEN RAISE EXCEPTION 'PROJECT_ARCHIVED' USING ERRCODE = 'P0001'; END IF;
  IF v_before.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'PROJECT_STALE' USING ERRCODE = 'P0001';
  END IF;

  v_target := coalesce((p_changes->>'semester_id')::uuid, v_before.semester_id);
  IF v_target <> v_before.semester_id THEN
    PERFORM public.project_lock_semester(v_target);
    -- The composite FKs (project_id, semester_id) would block this anyway; say why clearly.
    IF EXISTS (SELECT 1 FROM public.project_members WHERE project_id = p_project_id) THEN
      RAISE EXCEPTION 'PROJECT_HAS_ASSIGNMENTS' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.projects SET
    name        = CASE WHEN p_changes ? 'name' THEN btrim(p_changes->>'name') ELSE name END,
    description = CASE WHEN p_changes ? 'description' THEN nullif(btrim(p_changes->>'description'), '') ELSE description END,
    type        = CASE WHEN p_changes ? 'type' THEN p_changes->>'type' ELSE type END,
    status      = CASE WHEN p_changes ? 'status' THEN p_changes->>'status' ELSE status END,
    semester_id = v_target
  WHERE id = p_project_id
  RETURNING * INTO v_after;            -- 23505 duplicate name; 23503 email_campaigns FK; 23514 bad status; PROJECT_HAS_BOM

  SELECT array_agg(t.f ORDER BY t.f) INTO v_fields FROM (VALUES
    ('name',        v_before.name        IS DISTINCT FROM v_after.name),
    ('description', v_before.description IS DISTINCT FROM v_after.description),
    ('type',        v_before.type        IS DISTINCT FROM v_after.type),
    ('status',      v_before.status      IS DISTINCT FROM v_after.status),
    ('semester_id', v_before.semester_id IS DISTINCT FROM v_after.semester_id)) AS t(f, changed)
  WHERE t.changed;

  IF v_fields IS NOT NULL THEN
    INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
    VALUES (p_actor_id, 'PROJECT_UPDATED', 'PROJECT', v_after.id,
            jsonb_build_object(
              'semester_id', v_after.semester_id,
              'fields', to_jsonb(v_fields),
              -- description text is not copied into audit; only that it changed
              'before', jsonb_strip_nulls(jsonb_build_object(
                 'name', CASE WHEN 'name' = ANY(v_fields) THEN v_before.name END,
                 'type', CASE WHEN 'type' = ANY(v_fields) THEN v_before.type END,
                 'status', CASE WHEN 'status' = ANY(v_fields) THEN v_before.status END,
                 'semester_id', CASE WHEN 'semester_id' = ANY(v_fields) THEN v_before.semester_id END)),
              'after', jsonb_strip_nulls(jsonb_build_object(
                 'name', CASE WHEN 'name' = ANY(v_fields) THEN v_after.name END,
                 'type', CASE WHEN 'type' = ANY(v_fields) THEN v_after.type END,
                 'status', CASE WHEN 'status' = ANY(v_fields) THEN v_after.status END,
                 'semester_id', CASE WHEN 'semester_id' = ANY(v_fields) THEN v_after.semester_id END))),
            p_request_id);
  END IF;
  RETURN v_after;
END;
$$;

-- ---------- List: p_status filter, status column ----------
DROP FUNCTION public.admin_list_projects(uuid, text, text, text, integer, integer);
CREATE FUNCTION public.admin_list_projects(
  p_semester_id uuid, p_search text, p_type text, p_status text, p_archived text,
  p_limit integer, p_offset integer
) RETURNS TABLE (
  id uuid, semester_id uuid, name varchar, description text, type text, status text,
  archived_at timestamptz, created_by_user_id uuid, created_at timestamptz, updated_at timestamptz,
  member_count bigint, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.semester_id, p.name, p.description, p.type, p.status, p.archived_at,
         p.created_by_user_id, p.created_at, p.updated_at,
         (SELECT count(*) FROM public.project_members pm
           WHERE pm.project_id = p.id AND pm.removed_at IS NULL),
         count(*) OVER ()
    FROM public.projects p
   WHERE p.semester_id = p_semester_id
     AND (p_search IS NULL OR strpos(lower(p.name), lower(p_search)) > 0)
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
    'public.admin_create_project(uuid, uuid, text, text, text, text, text)',
    'public.admin_list_projects(uuid, text, text, text, text, integer, integer)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
