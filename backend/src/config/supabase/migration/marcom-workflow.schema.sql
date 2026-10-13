-- MARCOM workflow. Apply after department-scope.schema.sql.
--   1. Project types EVENT and CONTENT, tied to the MARCOM department (TECH keeps its three).
--   2. The slot rule (twin of backend/src/shared/resource-rules.ts) learns FINAL_PACKAGE, an Excel
--      file that any member assigned to the project can submit and replace.
--   3. Member-side upload functions for the final package.
--   4. The dashboard summary respects the department scope and counts the new types.
-- ALTER-based: safe on a DB with data.
BEGIN;

-- =============================================================================
-- 1. Project types per department
-- =============================================================================
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.projects'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%SOFTWARE%'
  LOOP
    EXECUTE format('ALTER TABLE public.projects DROP CONSTRAINT %I', c.conname);
  END LOOP;
END;
$$;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_type_check
  CHECK (type IN ('SOFTWARE', 'HARDWARE', 'RESEARCH', 'EVENT', 'CONTENT'));

-- The one place that says which department owns which project type.
CREATE FUNCTION public.department_project_types(p_department_id uuid)
RETURNS text[] LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE d.code
           WHEN 'TECH'   THEN ARRAY['SOFTWARE', 'HARDWARE', 'RESEARCH']
           WHEN 'MARCOM' THEN ARRAY['EVENT', 'CONTENT']
           ELSE ARRAY[]::text[]            -- HR has no project types yet
         END
    FROM public.departments d WHERE d.id = p_department_id;
$$;

CREATE FUNCTION public.projects_type_matches_department()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT (NEW.type = ANY (coalesce(public.department_project_types(NEW.department_id), ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'PROJECT_TYPE_NOT_IN_DEPARTMENT' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER projects_type_matches_department
BEFORE INSERT OR UPDATE OF type, department_id ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.projects_type_matches_department();

-- =============================================================================
-- 2. Slot rule
-- =============================================================================
CREATE OR REPLACE FUNCTION public.resource_slot_allowed(p_type text, p_slot text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_slot
    WHEN 'FIRST_MEETING' THEN true
    WHEN 'SRS' THEN p_type IN ('SOFTWARE', 'HARDWARE', 'RESEARCH')
    WHEN 'GITHUB_REPO' THEN p_type IN ('SOFTWARE', 'HARDWARE', 'RESEARCH')
    WHEN 'DEMO_GUIDE' THEN p_type IN ('SOFTWARE', 'HARDWARE', 'RESEARCH')
    WHEN 'BOM' THEN p_type = 'HARDWARE'
    WHEN 'RESEARCH_TEMPLATE' THEN p_type = 'RESEARCH'
    WHEN 'FINAL_PACKAGE' THEN p_type IN ('EVENT', 'CONTENT')
    ELSE false
  END;
$$;

-- EVENT and CONTENT projects have nothing they must be given: the deliverable is what members submit.
CREATE OR REPLACE FUNCTION public.project_required_slots(p_type text)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_type
    WHEN 'HARDWARE' THEN ARRAY['SRS', 'FIRST_MEETING', 'BOM']
    WHEN 'RESEARCH' THEN ARRAY['SRS', 'FIRST_MEETING', 'RESEARCH_TEMPLATE']
    WHEN 'EVENT'    THEN ARRAY[]::text[]
    WHEN 'CONTENT'  THEN ARRAY[]::text[]
    ELSE ARRAY['SRS', 'FIRST_MEETING']
  END;
$$;

ALTER TABLE public.project_files
  DROP CONSTRAINT project_files_slot_check,
  ADD CONSTRAINT project_files_slot_check
    CHECK (slot IN ('SRS', 'BOM', 'RESEARCH_TEMPLATE', 'FINAL_PACKAGE'));

ALTER TABLE public.project_resources
  DROP CONSTRAINT project_resources_slot_check,
  ADD CONSTRAINT project_resources_slot_check CHECK (slot IN
    ('SRS', 'FIRST_MEETING', 'BOM', 'RESEARCH_TEMPLATE', 'GITHUB_REPO', 'DEMO_GUIDE', 'FINAL_PACKAGE')),
  ADD CONSTRAINT project_resources_file_only_final_package CHECK (
    slot <> 'FINAL_PACKAGE' OR source_type = 'FILE');

-- A department admin (or the super-admin) may also upload / replace the package for the team.
CREATE OR REPLACE FUNCTION public.admin_begin_file_upload(
  p_actor_id uuid, p_project_id uuid, p_slot text, p_bucket_id text, p_object_path text,
  p_original_filename text, p_content_type text, p_size_bytes bigint, p_checksum_sha256 text
) RETURNS public.project_files
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_type text; v_row public.project_files;
BEGIN
  PERFORM public.assert_staff_actor(p_actor_id);
  v_type := public.files_lock_project(p_project_id);
  IF p_slot NOT IN ('SRS', 'BOM', 'RESEARCH_TEMPLATE', 'FINAL_PACKAGE') THEN
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
-- 3. Member final-package upload (same two-phase flow as the admin upload)
-- =============================================================================
-- The actor must be an active user with an ACTIVE roster entry in the current semester AND an
-- active assignment to this project. Returns their roster member id. No rows / not assigned
-- raise PROJECT_NOT_FOUND so an unknown project and a forbidden one look the same (D-09).
CREATE FUNCTION public.member_assert_assigned(p_actor_id uuid, p_project_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_roster_member_id uuid;
BEGIN
  SELECT pm.roster_member_id INTO v_roster_member_id
    FROM public.member_eligibility(p_actor_id) e
    JOIN public.project_members pm ON pm.roster_member_id = e.roster_member_id
                                  AND pm.project_id = p_project_id AND pm.removed_at IS NULL
    JOIN public.projects p ON p.id = pm.project_id AND p.semester_id = e.semester_id;
  IF v_roster_member_id IS NULL THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_roster_member_id;
END;
$$;

CREATE FUNCTION public.member_begin_final_package_upload(
  p_actor_id uuid, p_project_id uuid, p_bucket_id text, p_object_path text,
  p_original_filename text, p_content_type text, p_size_bytes bigint, p_checksum_sha256 text
) RETURNS public.project_files
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_type text; v_row public.project_files;
BEGIN
  PERFORM public.member_assert_assigned(p_actor_id, p_project_id);
  v_type := public.files_lock_project(p_project_id);          -- rejects an archived project
  IF NOT public.resource_slot_allowed(v_type, 'FINAL_PACKAGE') THEN
    RAISE EXCEPTION 'RESOURCE_SLOT_NOT_ALLOWED' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.project_files (project_id, slot, bucket_id, object_path, original_filename,
                                    content_type, size_bytes, checksum_sha256, status, uploaded_by_user_id)
  VALUES (p_project_id, 'FINAL_PACKAGE', p_bucket_id, p_object_path, p_original_filename,
          p_content_type, p_size_bytes, p_checksum_sha256, 'UPLOADING', p_actor_id)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE FUNCTION public.member_finalize_final_package_upload(
  p_actor_id uuid, p_file_id uuid, p_request_id text
) RETURNS public.project_files
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_file public.project_files; v_previous uuid;
BEGIN
  SELECT * INTO v_file FROM public.project_files
   WHERE id = p_file_id AND slot = 'FINAL_PACKAGE' AND uploaded_by_user_id = p_actor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FILE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.member_assert_assigned(p_actor_id, v_file.project_id);   -- still assigned
  PERFORM public.files_lock_project(v_file.project_id);

  SELECT * INTO v_file FROM public.project_files WHERE id = p_file_id FOR UPDATE;
  IF v_file.status <> 'UPLOADING' THEN RAISE EXCEPTION 'FILE_NOT_PENDING' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.project_files SET status = 'RETIRED', retired_at = now()
   WHERE project_id = v_file.project_id AND slot = 'FINAL_PACKAGE' AND status = 'ACTIVE'
  RETURNING id INTO v_previous;
  UPDATE public.project_files SET status = 'ACTIVE' WHERE id = p_file_id RETURNING * INTO v_file;

  DELETE FROM public.project_resources WHERE project_id = v_file.project_id AND slot = 'FINAL_PACKAGE';
  INSERT INTO public.project_resources (project_id, slot, source_type, file_id, updated_by_user_id)
  VALUES (v_file.project_id, 'FINAL_PACKAGE', 'FILE', v_file.id, p_actor_id);

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id,
          CASE WHEN v_previous IS NULL THEN 'FINAL_PACKAGE_SUBMITTED' ELSE 'FINAL_PACKAGE_REPLACED' END,
          'PROJECT_FILE', v_file.id,
          jsonb_strip_nulls(jsonb_build_object('project_id', v_file.project_id, 'slot', 'FINAL_PACKAGE',
            'size_bytes', v_file.size_bytes, 'previous_file_id', v_previous)), p_request_id);
  RETURN v_file;
END;
$$;

CREATE FUNCTION public.member_abort_final_package_upload(p_actor_id uuid, p_file_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.project_files
   WHERE id = p_file_id AND slot = 'FINAL_PACKAGE' AND uploaded_by_user_id = p_actor_id AND status = 'UPLOADING';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

-- =============================================================================
-- 4. Dashboard: department scope + the new types.
--    v_scope is NULL for ADMIN (everything) and the department id for DEPT_ADMIN.
--    Semester-wide things (kick-off imports, demo campaigns) are shown to ADMIN only.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_dashboard_summary(p_actor_id uuid, p_item_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_scope uuid;
  v_sem public.semesters;
  v_result jsonb;
BEGIN
  v_scope := public.assert_staff_actor(p_actor_id);
  SELECT * INTO v_sem FROM public.semesters WHERE is_current;

  v_result := jsonb_build_object(
    'semester', CASE WHEN v_sem.id IS NULL THEN NULL
                     ELSE jsonb_build_object('id', v_sem.id, 'name', v_sem.name) END,
    'department', (SELECT code FROM public.departments WHERE id = v_scope),
    'old_semester_scheduled', (
      SELECT jsonb_build_object(
        'count', count(*),
        'items', coalesce(jsonb_agg(jsonb_build_object(
          'id', c.id, 'name', coalesce(p.name::text, 'Demo'), 'kind', c.kind,
          'scheduled_at', c.scheduled_at, 'semester_name', s.name) ORDER BY c.scheduled_at)
          FILTER (WHERE c.rn <= p_item_limit), '[]'::jsonb))
        FROM (SELECT c.*, row_number() OVER (ORDER BY c.scheduled_at) AS rn
                FROM public.email_campaigns c
               WHERE c.status = 'SCHEDULED'
                 AND (v_sem.id IS NULL OR c.semester_id <> v_sem.id)) c
        JOIN public.semesters s ON s.id = c.semester_id
        LEFT JOIN public.projects p ON p.id = c.project_id
       WHERE v_scope IS NULL OR p.department_id = v_scope)
  );
  IF v_sem.id IS NULL THEN RETURN v_result; END IF;

  RETURN v_result || jsonb_build_object(
    'roster_active', (SELECT count(*) FROM public.roster_members
                       WHERE semester_id = v_sem.id AND status = 'ACTIVE'
                         AND (v_scope IS NULL OR department_id = v_scope)),
    'projects', jsonb_build_object(
      'software', (SELECT count(*) FROM public.projects
                    WHERE semester_id = v_sem.id AND archived_at IS NULL AND type = 'SOFTWARE'
                      AND (v_scope IS NULL OR department_id = v_scope)),
      'hardware', (SELECT count(*) FROM public.projects
                    WHERE semester_id = v_sem.id AND archived_at IS NULL AND type = 'HARDWARE'
                      AND (v_scope IS NULL OR department_id = v_scope)),
      'research', (SELECT count(*) FROM public.projects
                    WHERE semester_id = v_sem.id AND archived_at IS NULL AND type = 'RESEARCH'
                      AND (v_scope IS NULL OR department_id = v_scope)),
      'event', (SELECT count(*) FROM public.projects
                 WHERE semester_id = v_sem.id AND archived_at IS NULL AND type = 'EVENT'
                   AND (v_scope IS NULL OR department_id = v_scope)),
      'content', (SELECT count(*) FROM public.projects
                   WHERE semester_id = v_sem.id AND archived_at IS NULL AND type = 'CONTENT'
                     AND (v_scope IS NULL OR department_id = v_scope))),
    'upcoming_campaigns', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id', u.id, 'kind', u.kind, 'project_id', u.project_id,
               'name', coalesce(u.project_name, 'Demo'), 'scheduled_at', u.scheduled_at,
               'overdue', u.scheduled_at <= now()) ORDER BY u.scheduled_at), '[]'::jsonb)
        FROM (SELECT c.id, c.kind, c.project_id, p.name::text AS project_name, c.scheduled_at
                FROM public.email_campaigns c
                LEFT JOIN public.projects p ON p.id = c.project_id
               WHERE c.semester_id = v_sem.id AND c.status = 'SCHEDULED'
                 AND (v_scope IS NULL OR p.department_id = v_scope)
               ORDER BY c.scheduled_at LIMIT p_item_limit) u),
    'deliveries', (
      SELECT jsonb_build_object(
               'failed', count(*) FILTER (WHERE d.status IN ('FAILED_RETRYABLE', 'FAILED_PERMANENT')),
               'unknown', count(*) FILTER (WHERE d.status = 'UNKNOWN'))
        FROM public.email_deliveries d
       WHERE d.semester_id = v_sem.id
         AND (v_scope IS NULL OR EXISTS (
               SELECT 1 FROM public.email_campaigns c
                 JOIN public.projects p ON p.id = c.project_id
                WHERE c.id = d.campaign_id AND p.department_id = v_scope))),
    'projects_without_members', (
      SELECT jsonb_build_object('count', count(*),
               'items', coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name)
                                           ORDER BY x.name) FILTER (WHERE x.rn <= p_item_limit), '[]'::jsonb))
        FROM (SELECT p.id, p.name::text AS name, row_number() OVER (ORDER BY p.name, p.id) AS rn
                FROM public.projects p
               WHERE p.semester_id = v_sem.id AND p.archived_at IS NULL
                 AND (v_scope IS NULL OR p.department_id = v_scope)
                 AND NOT EXISTS (SELECT 1 FROM public.project_members pm
                                  WHERE pm.project_id = p.id AND pm.removed_at IS NULL)) x),
    'projects_missing_srs', (
      SELECT jsonb_build_object('count', count(*),
               'items', coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name)
                                           ORDER BY x.name) FILTER (WHERE x.rn <= p_item_limit), '[]'::jsonb))
        FROM (SELECT p.id, p.name::text AS name, row_number() OVER (ORDER BY p.name, p.id) AS rn
                FROM public.projects p
               WHERE p.semester_id = v_sem.id AND p.archived_at IS NULL
                 AND (v_scope IS NULL OR p.department_id = v_scope)
                 AND 'SRS' = ANY (public.project_required_slots(p.type))
                 AND NOT EXISTS (SELECT 1 FROM public.project_resources r
                                  WHERE r.project_id = p.id AND r.slot = 'SRS')) x),
    'projects_missing_resources', (
      SELECT jsonb_build_object('count', count(*),
               'items', coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'missing', x.missing)
                                           ORDER BY x.name) FILTER (WHERE x.rn <= p_item_limit), '[]'::jsonb))
        FROM (SELECT m.id, m.name, m.missing, row_number() OVER (ORDER BY m.name, m.id) AS rn
                FROM (SELECT p.id, p.name::text AS name,
                             ARRAY(SELECT s FROM unnest(public.project_required_slots(p.type)) s
                                    WHERE s <> 'SRS'
                                      AND NOT EXISTS (SELECT 1 FROM public.project_resources r
                                                       WHERE r.project_id = p.id AND r.slot = s)) AS missing
                        FROM public.projects p
                       WHERE p.semester_id = v_sem.id AND p.archived_at IS NULL
                         AND (v_scope IS NULL OR p.department_id = v_scope)) m
               WHERE cardinality(m.missing) > 0) x),
    -- MARCOM: projects that have a team but no submitted final package yet.
    'projects_without_final_package', (
      SELECT jsonb_build_object('count', count(*),
               'items', coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name)
                                           ORDER BY x.name) FILTER (WHERE x.rn <= p_item_limit), '[]'::jsonb))
        FROM (SELECT p.id, p.name::text AS name, row_number() OVER (ORDER BY p.name, p.id) AS rn
                FROM public.projects p
               WHERE p.semester_id = v_sem.id AND p.archived_at IS NULL
                 AND (v_scope IS NULL OR p.department_id = v_scope)
                 AND public.resource_slot_allowed(p.type, 'FINAL_PACKAGE')
                 AND EXISTS (SELECT 1 FROM public.project_members pm
                              WHERE pm.project_id = p.id AND pm.removed_at IS NULL)
                 AND NOT EXISTS (SELECT 1 FROM public.project_resources r
                                  WHERE r.project_id = p.id AND r.slot = 'FINAL_PACKAGE')) x),
    'campaigns_with_failures', (
      SELECT jsonb_build_object('count', count(*),
               'items', coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'kind', x.kind)
                                           ORDER BY x.completed_at DESC) FILTER (WHERE x.rn <= p_item_limit), '[]'::jsonb))
        FROM (SELECT c.id, coalesce(p.name::text, 'Demo') AS name, c.kind, c.completed_at,
                     row_number() OVER (ORDER BY c.completed_at DESC NULLS LAST, c.id) AS rn
                FROM public.email_campaigns c
                LEFT JOIN public.projects p ON p.id = c.project_id
               WHERE c.semester_id = v_sem.id AND c.status = 'COMPLETED_WITH_FAILURES'
                 AND (v_scope IS NULL OR p.department_id = v_scope)) x),
    'imports_expired_unused', (
      SELECT jsonb_build_object('count', count(*),
               'items', coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.filename, 'created_at', x.created_at)
                                           ORDER BY x.created_at DESC) FILTER (WHERE x.rn <= p_item_limit), '[]'::jsonb))
        FROM (SELECT i.id, i.filename, i.created_at,
                     row_number() OVER (ORDER BY i.created_at DESC, i.id) AS rn
                FROM public.roster_imports i
               WHERE v_scope IS NULL AND i.semester_id = v_sem.id
                 AND (i.status = 'EXPIRED' OR (i.status = 'PREVIEWED' AND i.expires_at <= now()))) x)
  );
END;
$$;

-- Backend (service_role) only.
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.department_project_types(uuid)',
    'public.projects_type_matches_department()',
    'public.member_assert_assigned(uuid, uuid)',
    'public.member_begin_final_package_upload(uuid, uuid, text, text, text, text, bigint, text)',
    'public.member_finalize_final_package_upload(uuid, uuid, text)',
    'public.member_abort_final_package_upload(uuid, uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[
    'public.member_assert_assigned(uuid, uuid)',
    'public.member_begin_final_package_upload(uuid, uuid, text, text, text, text, bigint, text)',
    'public.member_finalize_final_package_upload(uuid, uuid, text)',
    'public.member_abort_final_package_upload(uuid, uuid)'
  ] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
