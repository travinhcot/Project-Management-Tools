-- Department scope for DEPT_ADMIN. Apply after departments.schema.sql.
--
-- How it works (write once, enforced for every function that opts in):
--   1. public.assert_staff_actor(actor) admits ADMIN and DEPT_ADMIN and records the actor's
--      department in the transaction-local setting `app.department_scope` ('' for ADMIN).
--      Every RPC is its own transaction, so the setting never leaks to another request.
--   2. BEFORE triggers on projects, project_members, project_files, project_resources,
--      roster_members and email_campaigns refuse (OUT_OF_SCOPE, 42501) any row that belongs to
--      another department while a scope is set. Writes are therefore enforced by the database,
--      whatever the function body does.
--   3. Read functions that list rows take an explicit p_department_id.
--
-- Functions NOT switched below keep public.assert_admin_actor (ADMIN only): semesters, roster import,
-- audit, user management, demo campaigns and every email function. A DEPT_ADMIN is refused by them.
BEGIN;

-- =============================================================================
-- 1. The scope
-- =============================================================================
CREATE OR REPLACE FUNCTION public.assert_staff_actor(p_actor_id uuid)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_user public.app_users;
BEGIN
  SELECT * INTO v_user FROM public.app_users
   WHERE id = p_actor_id AND is_active AND role IN ('ADMIN', 'DEPT_ADMIN');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  -- Transaction-local (true): cleared automatically when the RPC's transaction ends.
  PERFORM set_config('app.department_scope', coalesce(v_user.department_id::text, ''), true);
  RETURN v_user.department_id;  -- NULL for ADMIN
END;
$$;

CREATE FUNCTION public.current_department_scope()
RETURNS uuid LANGUAGE sql STABLE SET search_path = ''
AS $$ SELECT nullif(current_setting('app.department_scope', true), '')::uuid; $$;

CREATE FUNCTION public.department_scope_check(p_department_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SET search_path = ''
AS $$
DECLARE v_scope uuid := public.current_department_scope();
BEGIN
  IF v_scope IS NOT NULL AND p_department_id IS DISTINCT FROM v_scope THEN
    RAISE EXCEPTION 'OUT_OF_SCOPE' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE FUNCTION public.department_label(p_department_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = ''
AS $$ SELECT CASE code WHEN 'TECH' THEN 'Tech' WHEN 'MARCOM' THEN 'Marcom' WHEN 'HR' THEN 'HR' ELSE code END
        FROM public.departments WHERE id = p_department_id; $$;

REVOKE ALL ON FUNCTION public.assert_staff_actor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_department_scope() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.department_scope_check(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.department_label(uuid) FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 2. Row guards
-- =============================================================================
-- New projects default to the actor's department (ADMIN creates through admin_create_project).
CREATE OR REPLACE FUNCTION public.projects_default_department()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.department_id IS NULL THEN
    NEW.department_id := coalesce(
      public.current_department_scope(),
      (SELECT id FROM public.departments WHERE code = 'TECH'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.projects_scope_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN PERFORM public.department_scope_check(OLD.department_id); END IF;
  IF TG_OP <> 'DELETE' THEN PERFORM public.department_scope_check(NEW.department_id); END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER projects_scope_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.projects_scope_guard();

-- Rows that hang off a project (members, files, resources): the project decides.
CREATE FUNCTION public.project_child_scope_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_department uuid;
BEGIN
  IF public.current_department_scope() IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  SELECT department_id INTO v_department FROM public.projects
   WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.project_id ELSE NEW.project_id END;
  PERFORM public.department_scope_check(v_department);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER project_files_scope_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.project_files
FOR EACH ROW EXECUTE FUNCTION public.project_child_scope_guard();
CREATE TRIGGER project_resources_scope_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.project_resources
FOR EACH ROW EXECUTE FUNCTION public.project_child_scope_guard();

-- Project assignments: the project AND the member must both be in scope.
CREATE FUNCTION public.project_members_scope_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_row public.project_members; v_department uuid;
BEGIN
  IF public.current_department_scope() IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  SELECT department_id INTO v_department FROM public.projects WHERE id = v_row.project_id;
  PERFORM public.department_scope_check(v_department);
  SELECT department_id INTO v_department FROM public.roster_members WHERE id = v_row.roster_member_id;
  PERFORM public.department_scope_check(v_department);
  RETURN v_row;
END;
$$;
CREATE TRIGGER project_members_scope_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.project_members
FOR EACH ROW EXECUTE FUNCTION public.project_members_scope_guard();

-- Roster: named so it fires AFTER roster_members_sync_department (which derives department_id from
-- the legacy text column). A department admin's new member defaults to their own department.
CREATE FUNCTION public.roster_members_scope_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_scope uuid := public.current_department_scope();
BEGIN
  IF v_scope IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.department_id IS NULL THEN
    NEW.department_id := v_scope;
    NEW.department := public.department_label(v_scope);
  END IF;
  IF TG_OP <> 'INSERT' THEN PERFORM public.department_scope_check(OLD.department_id); END IF;
  IF TG_OP <> 'DELETE' THEN PERFORM public.department_scope_check(NEW.department_id); END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER roster_members_z_scope_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.roster_members
FOR EACH ROW EXECUTE FUNCTION public.roster_members_scope_guard();

-- Campaigns: only project campaigns can be in scope; semester-wide ones (DEMO) never are.
CREATE FUNCTION public.email_campaigns_scope_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_row public.email_campaigns; v_department uuid;
BEGIN
  IF public.current_department_scope() IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF v_row.project_id IS NULL THEN RAISE EXCEPTION 'OUT_OF_SCOPE' USING ERRCODE = '42501'; END IF;
  SELECT department_id INTO v_department FROM public.projects WHERE id = v_row.project_id;
  PERFORM public.department_scope_check(v_department);
  RETURN v_row;
END;
$$;
CREATE TRIGGER email_campaigns_scope_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.email_campaigns
FOR EACH ROW EXECUTE FUNCTION public.email_campaigns_scope_guard();

REVOKE ALL ON FUNCTION public.projects_scope_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.project_child_scope_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.project_members_scope_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.roster_members_scope_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_campaigns_scope_guard() FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 3. Opt functions in: swap the ADMIN-only assertion for the scope-setting one.
--    Done on the live definitions so their bodies (the latest deployed versions) are not copied.
-- =============================================================================
DO $$
DECLARE
  r record;
  v_def text;
  v_names text[] := ARRAY[
    -- projects
    'admin_update_project', 'admin_archive_project', 'admin_unarchive_project',
    -- assignments
    'admin_assign_project_members', 'admin_remove_project_member', 'admin_set_project_member_role',
    -- resources and files
    'admin_set_project_resource_link', 'admin_clear_project_resource',
    'admin_begin_file_upload', 'admin_abort_file_upload', 'finalize_file_upload',
    -- roster members
    'admin_add_roster_member', 'admin_update_roster_member',
    'admin_roster_delete_impact', 'admin_delete_roster_member'
  ];
  v_seen text[] := '{}';
BEGIN
  FOR r IN
    SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = ANY (v_names)
  LOOP
    v_def := pg_get_functiondef(r.oid);
    IF position('public.assert_admin_actor(' IN v_def) = 0 THEN
      RAISE EXCEPTION 'Expected an admin assertion in %', r.proname;
    END IF;
    v_def := replace(v_def, 'public.assert_admin_actor(', 'public.assert_staff_actor(');
    -- "Admin accounts cannot be deleted as members" now covers department admins too.
    v_def := replace(v_def, 'v_account.role = ''ADMIN''', 'v_account.role IN (''ADMIN'', ''DEPT_ADMIN'')');
    EXECUTE v_def;
    v_seen := v_seen || r.proname::text;
  END LOOP;
  IF cardinality(ARRAY(SELECT DISTINCT unnest(v_seen))) <> cardinality(v_names) THEN
    RAISE EXCEPTION 'Not every function to scope exists; found %', v_seen;
  END IF;
END;
$$;

-- =============================================================================
-- 4. admin_create_project: the department comes from the scope (DEPT_ADMIN) or the argument (ADMIN)
-- =============================================================================
DROP FUNCTION public.admin_create_project(uuid, uuid, text, text, text, text, text);
CREATE FUNCTION public.admin_create_project(
  p_actor_id uuid, p_semester_id uuid, p_name text, p_type text, p_description text,
  p_status text, p_request_id text, p_department_code text DEFAULT NULL
) RETURNS public.projects
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_row public.projects;
  v_scope uuid;
  v_department uuid;
BEGIN
  v_scope := public.assert_staff_actor(p_actor_id);
  IF v_scope IS NOT NULL THEN
    v_department := v_scope;  -- a department admin can only create in their own department
  ELSE
    SELECT id INTO v_department FROM public.departments WHERE code = coalesce(p_department_code, 'TECH');
    IF v_department IS NULL THEN RAISE EXCEPTION 'INVALID_DEPARTMENT' USING ERRCODE = '22023'; END IF;
  END IF;
  PERFORM public.project_lock_semester(p_semester_id);
  INSERT INTO public.projects (semester_id, name, type, description, status, created_by_user_id, department_id)
  VALUES (p_semester_id, btrim(p_name), p_type, nullif(btrim(p_description), ''),
          coalesce(p_status, 'PLANNING'), p_actor_id, v_department)
  RETURNING * INTO v_row;                                   -- same name in semester -> 23505

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'PROJECT_CREATED', 'PROJECT', v_row.id,
          jsonb_build_object('semester_id', v_row.semester_id, 'name', v_row.name,
                             'type', v_row.type, 'status', v_row.status,
                             'department_id', v_row.department_id),
          p_request_id);
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_create_project(uuid, uuid, text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_project(uuid, uuid, text, text, text, text, text, text) TO service_role;

-- Download authorization: the project must be in the actor's scope too.
CREATE OR REPLACE FUNCTION public.admin_get_project_file(p_actor_id uuid, p_project_id uuid, p_file_id uuid)
RETURNS TABLE (bucket_id text, object_path text, original_filename text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_scope uuid;
BEGIN
  v_scope := public.assert_staff_actor(p_actor_id);
  RETURN QUERY
  SELECT f.bucket_id, f.object_path, f.original_filename FROM public.project_files f
    JOIN public.projects p ON p.id = f.project_id
   WHERE f.id = p_file_id AND f.project_id = p_project_id AND f.status IN ('ACTIVE', 'RETIRED')
     AND (v_scope IS NULL OR p.department_id = v_scope);
END;
$$;

-- =============================================================================
-- 5. Lists: an explicit department filter (NULL = every department) and the department shown
-- =============================================================================
DROP FUNCTION public.admin_list_projects(uuid, text, text, text, text, integer, integer);
CREATE FUNCTION public.admin_list_projects(
  p_semester_id uuid, p_search text, p_type text, p_status text, p_archived text,
  p_limit integer, p_offset integer, p_department_id uuid DEFAULT NULL
) RETURNS TABLE (
  id uuid, semester_id uuid, name varchar, description text, type text, status text,
  archived_at timestamptz, created_by_user_id uuid, created_at timestamptz, updated_at timestamptz,
  member_count bigint, leader_roster_member_id uuid, leader_name varchar, total_count bigint,
  department_code text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.semester_id, p.name, p.description, p.type, p.status, p.archived_at,
         p.created_by_user_id, p.created_at, p.updated_at,
         (SELECT count(*) FROM public.project_members pm
           WHERE pm.project_id = p.id AND pm.removed_at IS NULL),
         l.roster_member_id, l.full_name,
         count(*) OVER (),
         d.code
    FROM public.projects p
    JOIN public.departments d ON d.id = p.department_id
    LEFT JOIN LATERAL (
      SELECT pm.roster_member_id, rm.full_name
        FROM public.project_members pm
        JOIN public.roster_members rm ON rm.id = pm.roster_member_id
       WHERE pm.project_id = p.id AND pm.role = 'LEADER' AND pm.removed_at IS NULL
       LIMIT 1) l ON true
   WHERE p.semester_id = p_semester_id
     AND (p_department_id IS NULL OR p.department_id = p_department_id)
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

DROP FUNCTION public.admin_list_roster(uuid, text, text, boolean, text, integer, integer, integer);
CREATE FUNCTION public.admin_list_roster(
  p_semester_id uuid, p_search text, p_status text, p_linked boolean,
  p_department text, p_birth_year integer, p_limit integer, p_offset integer,
  p_department_id uuid DEFAULT NULL
) RETURNS TABLE (
  id uuid, semester_id uuid, user_id uuid, email varchar, full_name varchar,
  other_info jsonb, department varchar, birth_year smallint, major varchar,
  status text, deactivated_at timestamptz, deactivation_reason varchar,
  last_import_id uuid, created_at timestamptz, updated_at timestamptz, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.semesters s WHERE s.id = p_semester_id) THEN
    RAISE EXCEPTION 'SEMESTER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  RETURN QUERY
  SELECT m.id, m.semester_id, m.user_id, m.email, m.full_name, m.other_info,
         m.department, m.birth_year, m.major, m.status,
         m.deactivated_at, m.deactivation_reason, m.last_import_id, m.created_at, m.updated_at,
         count(*) OVER ()
    FROM public.roster_members m
   WHERE m.semester_id = p_semester_id
     AND (p_department_id IS NULL OR m.department_id = p_department_id)
     AND (p_search IS NULL
          OR strpos(m.normalized_email, lower(p_search)) > 0
          OR strpos(lower(m.full_name), lower(p_search)) > 0)
     AND (p_status IS NULL OR m.status = p_status)
     AND (p_linked IS NULL OR (m.user_id IS NOT NULL) = p_linked)
     AND (p_department IS NULL OR lower(m.department) = lower(p_department))
     AND (p_birth_year IS NULL OR m.birth_year = p_birth_year)
   ORDER BY lower(m.full_name), m.id
   LIMIT least(greatest(p_limit, 1), 100)
  OFFSET greatest(p_offset, 0);
END;
$$;

DROP FUNCTION public.admin_list_roster_departments(uuid);
CREATE FUNCTION public.admin_list_roster_departments(p_semester_id uuid, p_department_id uuid DEFAULT NULL)
RETURNS TABLE (department varchar)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.semesters s WHERE s.id = p_semester_id) THEN
    RAISE EXCEPTION 'SEMESTER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  RETURN QUERY
  SELECT d.department FROM (
    SELECT DISTINCT ON (lower(m.department)) m.department
      FROM public.roster_members m
     WHERE m.semester_id = p_semester_id AND m.department IS NOT NULL
       AND (p_department_id IS NULL OR m.department_id = p_department_id)
     ORDER BY lower(m.department), m.department) d
  ORDER BY lower(d.department);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_projects(uuid, text, text, text, text, integer, integer, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_roster(uuid, text, text, boolean, text, integer, integer, integer, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_roster_departments(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_projects(uuid, text, text, text, text, integer, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_roster(uuid, text, text, boolean, text, integer, integer, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_roster_departments(uuid, uuid) TO service_role;

COMMIT;
