-- Makes project documentation and linked department resources MARCOM-only (EVENT, CONTENT projects).
-- Apply AFTER project-documentation.schema.sql has already been run. Safe to run more than once.
BEGIN;

-- 1. The slot rule: DOCUMENTATION only for MARCOM project types.
CREATE OR REPLACE FUNCTION public.resource_slot_allowed(p_type text, p_slot text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_slot
    WHEN 'FIRST_MEETING' THEN true
    WHEN 'DOCUMENTATION' THEN p_type IN ('EVENT', 'CONTENT')
    WHEN 'SRS' THEN p_type IN ('SOFTWARE', 'HARDWARE', 'RESEARCH')
    WHEN 'GITHUB_REPO' THEN p_type IN ('SOFTWARE', 'HARDWARE', 'RESEARCH')
    WHEN 'DEMO_GUIDE' THEN p_type IN ('SOFTWARE', 'HARDWARE', 'RESEARCH')
    WHEN 'BOM' THEN p_type = 'HARDWARE'
    WHEN 'RESEARCH_TEMPLATE' THEN p_type = 'RESEARCH'
    WHEN 'FINAL_PACKAGE' THEN p_type IN ('EVENT', 'CONTENT')
    ELSE false
  END;
$$;

-- 2. Linking library entries: refuse projects that are not MARCOM (EVENT / CONTENT).
CREATE OR REPLACE FUNCTION public.admin_set_project_department_resources(
  p_actor_id uuid, p_project_id uuid, p_resource_ids uuid[], p_request_id text
) RETURNS uuid[] LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_department uuid; v_type text; v_ids uuid[] := coalesce(p_resource_ids, ARRAY[]::uuid[]);
BEGIN
  PERFORM public.assert_staff_actor(p_actor_id);
  v_type := public.files_lock_project(p_project_id);        -- rejects an archived project
  IF v_type NOT IN ('EVENT', 'CONTENT') THEN                -- only MARCOM projects link library entries
    RAISE EXCEPTION 'RESOURCE_SLOT_NOT_ALLOWED' USING ERRCODE = 'P0001';
  END IF;
  SELECT department_id INTO v_department FROM public.projects WHERE id = p_project_id;
  PERFORM public.department_scope_check(v_department);

  IF cardinality(v_ids) > 100 THEN RAISE EXCEPTION 'TOO_MANY_RESOURCES' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_ids) AS r(id)
              WHERE NOT EXISTS (SELECT 1 FROM public.department_resources dr
                                 WHERE dr.id = r.id AND dr.department_id = v_department)) THEN
    RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.project_department_resources
   WHERE project_id = p_project_id AND NOT (resource_id = ANY (v_ids));
  INSERT INTO public.project_department_resources (project_id, resource_id, added_by_user_id)
  SELECT p_project_id, r.id, p_actor_id FROM (SELECT DISTINCT unnest(v_ids) AS id) r
  ON CONFLICT (project_id, resource_id) DO NOTHING;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'PROJECT_DEPARTMENT_RESOURCES_SET', 'PROJECT', p_project_id,
          jsonb_build_object('resource_count', cardinality(v_ids)), p_request_id);
  RETURN public.project_department_resource_ids(p_actor_id, p_project_id);
END;
$$;

-- 3. Clean up anything already saved on non-MARCOM projects (the uploaded objects are kept in storage).
UPDATE public.project_files f SET status = 'RETIRED', retired_at = now()
  FROM public.projects p
 WHERE f.project_id = p.id AND f.slot = 'DOCUMENTATION' AND f.status IN ('UPLOADING', 'ACTIVE')
   AND p.type NOT IN ('EVENT', 'CONTENT');

DELETE FROM public.project_resources r
 USING public.projects p
 WHERE r.project_id = p.id AND r.slot = 'DOCUMENTATION' AND p.type NOT IN ('EVENT', 'CONTENT');

DELETE FROM public.project_department_resources l
 USING public.projects p
 WHERE l.project_id = p.id AND p.type NOT IN ('EVENT', 'CONTENT');

COMMIT;
