-- Project documentation and linked department resources. Apply after member-department-scope.schema.sql.
--   1. New slot DOCUMENTATION: one Excel or Word file per project, uploaded or replaced by staff
--      (ADMIN / DEPT_ADMIN) and downloadable by the project's members. Uses the existing two-phase
--      upload (admin_begin_file_upload -> finalize_file_upload) and admin_clear_project_resource.
--      Twin of backend/src/shared/resource-rules.ts.
--   2. project_department_resources: which entries of the department's resource library a project
--      links to. Staff set the whole list; staff of the department and the project's members read it.
-- ALTER-based: safe on a DB with data.
BEGIN;

-- =============================================================================
-- 1. DOCUMENTATION slot
-- =============================================================================
CREATE OR REPLACE FUNCTION public.resource_slot_allowed(p_type text, p_slot text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_slot
    WHEN 'FIRST_MEETING' THEN true
    WHEN 'DOCUMENTATION' THEN true
    WHEN 'SRS' THEN p_type IN ('SOFTWARE', 'HARDWARE', 'RESEARCH')
    WHEN 'GITHUB_REPO' THEN p_type IN ('SOFTWARE', 'HARDWARE', 'RESEARCH')
    WHEN 'DEMO_GUIDE' THEN p_type IN ('SOFTWARE', 'HARDWARE', 'RESEARCH')
    WHEN 'BOM' THEN p_type = 'HARDWARE'
    WHEN 'RESEARCH_TEMPLATE' THEN p_type = 'RESEARCH'
    WHEN 'FINAL_PACKAGE' THEN p_type IN ('EVENT', 'CONTENT')
    ELSE false
  END;
$$;

ALTER TABLE public.project_files
  DROP CONSTRAINT project_files_slot_check,
  ADD CONSTRAINT project_files_slot_check
    CHECK (slot IN ('SRS', 'BOM', 'RESEARCH_TEMPLATE', 'FINAL_PACKAGE', 'DOCUMENTATION'));

ALTER TABLE public.project_resources
  DROP CONSTRAINT project_resources_slot_check,
  ADD CONSTRAINT project_resources_slot_check CHECK (slot IN
    ('SRS', 'FIRST_MEETING', 'BOM', 'RESEARCH_TEMPLATE', 'GITHUB_REPO', 'DEMO_GUIDE', 'FINAL_PACKAGE',
     'DOCUMENTATION')),
  ADD CONSTRAINT project_resources_file_only_documentation CHECK (
    slot <> 'DOCUMENTATION' OR source_type = 'FILE');

-- Staff may now also upload the documentation file.
CREATE OR REPLACE FUNCTION public.admin_begin_file_upload(
  p_actor_id uuid, p_project_id uuid, p_slot text, p_bucket_id text, p_object_path text,
  p_original_filename text, p_content_type text, p_size_bytes bigint, p_checksum_sha256 text
) RETURNS public.project_files
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_type text; v_row public.project_files;
BEGIN
  PERFORM public.assert_staff_actor(p_actor_id);
  v_type := public.files_lock_project(p_project_id);
  IF p_slot NOT IN ('SRS', 'BOM', 'RESEARCH_TEMPLATE', 'FINAL_PACKAGE', 'DOCUMENTATION') THEN
    RAISE EXCEPTION 'RESOURCE_SOURCE_NOT_ALLOWED' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.resource_slot_allowed(v_type, p_slot) THEN
    RAISE EXCEPTION 'RESOURCE_SLOT_NOT_ALLOWED' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.project_files (project_id, slot, bucket_id, object_path, original_filename,
                                    content_type, size_bytes, checksum_sha256, status, uploaded_by_user_id)
  VALUES (p_project_id, p_slot, p_bucket_id, p_object_path, p_original_filename,
          p_content_type, p_size_bytes, p_checksum_sha256, 'UPLOADING', p_actor_id)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- =============================================================================
-- 2. Department resources linked to a project
-- =============================================================================
CREATE TABLE public.project_department_resources (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.department_resources(id) ON DELETE CASCADE,
  added_by_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, resource_id)
);
CREATE INDEX project_department_resources_resource ON public.project_department_resources (resource_id);

ALTER TABLE public.project_department_resources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.project_department_resources FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_department_resources TO service_role;

CREATE TRIGGER project_department_resources_scope_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.project_department_resources
FOR EACH ROW EXECUTE FUNCTION public.project_child_scope_guard();

-- Linked resource ids of a project. Staff of the project's department (ADMIN: any) and members
-- assigned to the project may read; everyone else sees PROJECT_NOT_FOUND (same as an unknown id).
CREATE FUNCTION public.project_department_resource_ids(p_actor_id uuid, p_project_id uuid)
RETURNS uuid[] LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user public.app_users; v_project public.projects;
BEGIN
  SELECT * INTO v_user FROM public.app_users WHERE id = p_actor_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  IF v_user.role = 'DEPT_ADMIN' THEN
    IF v_project.department_id IS DISTINCT FROM v_user.department_id THEN
      RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
  ELSIF v_user.role <> 'ADMIN' THEN
    IF NOT EXISTS (SELECT 1 FROM public.member_get_project(p_actor_id, p_project_id, true)) THEN
      RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN coalesce((SELECT array_agg(l.resource_id ORDER BY l.created_at, l.resource_id)
                     FROM public.project_department_resources l
                    WHERE l.project_id = p_project_id), ARRAY[]::uuid[]);
END;
$$;

-- Replaces the whole list. Every id must belong to the project's own department library.
CREATE FUNCTION public.admin_set_project_department_resources(
  p_actor_id uuid, p_project_id uuid, p_resource_ids uuid[], p_request_id text
) RETURNS uuid[] LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_department uuid; v_ids uuid[] := coalesce(p_resource_ids, ARRAY[]::uuid[]);
BEGIN
  PERFORM public.assert_staff_actor(p_actor_id);
  PERFORM public.files_lock_project(p_project_id);          -- rejects an archived project
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

-- Backend (service_role) only.
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.project_department_resource_ids(uuid, uuid)',
    'public.admin_set_project_department_resources(uuid, uuid, uuid[], text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
