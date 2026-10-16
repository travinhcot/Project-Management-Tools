-- Departments (TECH, MARCOM, HR) and department admins. Apply after every other migration
-- (it replaces admin_list_users / admin_update_user_access from user-management.schema.sql).
-- ALTER-based: safe on a DB with data. Existing projects and roster members become TECH.
--
-- Fail-closed by design: public.assert_admin_actor is left ADMIN-only, so a DEPT_ADMIN is refused
-- by every existing admin_* function until that function is rewritten to call
-- public.assert_staff_actor and honour the returned department scope.
BEGIN;

-- =============================================================================
-- 1. departments
-- =============================================================================
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z]{2,12}$'),
  name varchar(100) NOT NULL CHECK (length(btrim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.departments (code, name) VALUES
  ('TECH', 'Technology'),
  ('MARCOM', 'Marketing & Communications'),
  ('HR', 'Human Resources');

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.departments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.departments TO service_role;

-- =============================================================================
-- 2. app_users: DEPT_ADMIN role bound to exactly one department
-- =============================================================================
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.app_users'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%ADMIN%'
       AND pg_get_constraintdef(oid) LIKE '%MEMBER%'
  LOOP
    EXECUTE format('ALTER TABLE public.app_users DROP CONSTRAINT %I', c.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.app_users
  ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE RESTRICT,
  ADD CONSTRAINT app_users_role_check CHECK (role IN ('ADMIN', 'DEPT_ADMIN', 'MEMBER')),
  ADD CONSTRAINT app_users_department_matches_role
    CHECK ((role = 'DEPT_ADMIN') = (department_id IS NOT NULL));

-- =============================================================================
-- 3. Mapping from the old free-text roster department to a department.
--    NULL for text that is not one of the three departments.
-- =============================================================================
CREATE FUNCTION public.department_id_from_text(p_text text)
RETURNS uuid LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT d.id FROM public.departments d
   WHERE d.code = CASE lower(btrim(p_text))
                    WHEN 'tech' THEN 'TECH' WHEN 'technology' THEN 'TECH'
                    WHEN 'marcom' THEN 'MARCOM' WHEN 'marketing' THEN 'MARCOM'
                    WHEN 'marketing & communications' THEN 'MARCOM'
                    WHEN 'marketing and communications' THEN 'MARCOM'
                    WHEN 'hr' THEN 'HR' WHEN 'human resources' THEN 'HR'
                  END;
$$;

-- Pre-check: no auto-guessing. Abort with the list of department texts nobody can map.
DO $$
DECLARE unmapped text;
BEGIN
  SELECT string_agg(format('%L (%s rows)', t.department, t.n), '; ')
    INTO unmapped
    FROM (SELECT department, count(*) AS n FROM public.roster_members
           WHERE department IS NOT NULL AND public.department_id_from_text(department) IS NULL
           GROUP BY department) t;
  IF unmapped IS NOT NULL THEN
    RAISE EXCEPTION 'Rename these roster departments to Tech, Marcom or HR before migrating: %', unmapped;
  END IF;
END;
$$;

-- =============================================================================
-- 4. roster_members.department_id (the text column stays for one release)
-- =============================================================================
ALTER TABLE public.roster_members
  ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE RESTRICT;

UPDATE public.roster_members
   SET department_id = coalesce(public.department_id_from_text(department),
                                (SELECT id FROM public.departments WHERE code = 'TECH'));

CREATE INDEX roster_members_semester_department_id
  ON public.roster_members (semester_id, department_id);

-- Existing roster functions still write only the text column; derive the id from it.
CREATE FUNCTION public.roster_members_sync_department()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.department_id IS NULL THEN
      NEW.department_id := public.department_id_from_text(NEW.department);
    END IF;
  ELSIF NEW.department IS DISTINCT FROM OLD.department
        AND NEW.department_id IS NOT DISTINCT FROM OLD.department_id THEN
    NEW.department_id := public.department_id_from_text(NEW.department);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER roster_members_sync_department
BEFORE INSERT OR UPDATE ON public.roster_members
FOR EACH ROW EXECUTE FUNCTION public.roster_members_sync_department();

-- =============================================================================
-- 5. projects.department_id (new rows default to TECH until create is department-aware)
-- =============================================================================
ALTER TABLE public.projects
  ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE RESTRICT;
UPDATE public.projects
   SET department_id = (SELECT id FROM public.departments WHERE code = 'TECH');

CREATE FUNCTION public.projects_default_department()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.department_id IS NULL THEN
    SELECT id INTO NEW.department_id FROM public.departments WHERE code = 'TECH';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER projects_default_department
BEFORE INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.projects_default_department();

ALTER TABLE public.projects ALTER COLUMN department_id SET NOT NULL;
CREATE INDEX projects_department ON public.projects (department_id, semester_id);

-- Moving a project to another department would orphan its members' scope.
CREATE FUNCTION public.projects_department_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
    RAISE EXCEPTION 'PROJECT_DEPARTMENT_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER projects_department_immutable
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.projects_department_immutable();

-- =============================================================================
-- 6. Actor helpers for the department-scoped functions
-- =============================================================================
-- Returns the actor's scope: NULL = every department (ADMIN), otherwise the department id.
-- Raises FORBIDDEN for anyone who is not an active ADMIN or DEPT_ADMIN.
CREATE FUNCTION public.assert_staff_actor(p_actor_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_user public.app_users;
BEGIN
  SELECT * INTO v_user FROM public.app_users
   WHERE id = p_actor_id AND is_active AND role IN ('ADMIN', 'DEPT_ADMIN');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN v_user.department_id;  -- NULL for ADMIN
END;
$$;

CREATE FUNCTION public.department_in_scope(p_scope uuid, p_department_id uuid)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$ SELECT p_scope IS NULL OR p_scope = p_department_id; $$;

REVOKE ALL ON FUNCTION public.department_id_from_text(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_staff_actor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.department_in_scope(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.roster_members_sync_department() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.projects_default_department() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.projects_department_immutable() FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 7. User management: list shows the department, update can set role + department
-- =============================================================================
DROP FUNCTION public.admin_list_users(text, text, boolean, integer, integer);
CREATE FUNCTION public.admin_list_users(
  p_search    text,
  p_role      text,
  p_is_active boolean,
  p_limit     integer,
  p_offset    integer
) RETURNS TABLE (
  id uuid, email varchar, full_name varchar, role text, department_code text, is_active boolean,
  last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz,
  total_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT u.id, u.email, u.full_name, u.role, d.code::text, u.is_active,
         a.last_sign_in_at, u.created_at, u.updated_at,
         count(*) OVER () AS total_count
    FROM public.app_users u
    JOIN auth.users a ON a.id = u.id
    LEFT JOIN public.departments d ON d.id = u.department_id
   WHERE (p_search IS NULL
          OR strpos(u.normalized_email, lower(p_search)) > 0
          OR strpos(lower(u.full_name), lower(p_search)) > 0)
     AND (p_role IS NULL OR u.role = p_role)
     AND (p_is_active IS NULL OR u.is_active = p_is_active)
   ORDER BY u.created_at DESC, u.id
   LIMIT least(greatest(p_limit, 1), 100)
  OFFSET greatest(p_offset, 0);
$$;

-- p_department_code is only meaningful for DEPT_ADMIN. Resulting rule:
--   role DEPT_ADMIN -> a department is required (given now, or already stored);
--   any other role  -> the department is cleared.
DROP FUNCTION public.admin_update_user_access(uuid, uuid, text, boolean, text);
CREATE FUNCTION public.admin_update_user_access(
  p_actor_id        uuid,
  p_target_id       uuid,
  p_role            text    DEFAULT NULL,
  p_is_active       boolean DEFAULT NULL,
  p_request_id      text    DEFAULT NULL,
  p_department_code text    DEFAULT NULL
) RETURNS public.app_users
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_before public.app_users;
  v_after  public.app_users;
  v_other_admins integer;
  v_new_role text;
  v_new_department uuid;
BEGIN
  IF p_role IS NULL AND p_is_active IS NULL AND p_department_code IS NULL THEN
    RAISE EXCEPTION 'NO_CHANGES' USING ERRCODE = '22023';
  END IF;
  IF p_role IS NOT NULL AND p_role NOT IN ('ADMIN', 'DEPT_ADMIN', 'MEMBER') THEN
    RAISE EXCEPTION 'INVALID_ROLE' USING ERRCODE = '22023';
  END IF;

  -- Serialize every change to the admin set (two admins demoting each other at once).
  PERFORM pg_advisory_xact_lock(hashtext('app_users.admin_set'));

  -- Only a super-admin manages access. Re-checked after the lock.
  IF NOT EXISTS (SELECT 1 FROM public.app_users
                  WHERE id = p_actor_id AND role = 'ADMIN' AND is_active) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_before FROM public.app_users WHERE id = p_target_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  v_new_role := coalesce(p_role, v_before.role);
  IF v_new_role = 'DEPT_ADMIN' THEN
    IF p_department_code IS NOT NULL THEN
      SELECT id INTO v_new_department FROM public.departments WHERE code = p_department_code;
      IF v_new_department IS NULL THEN
        RAISE EXCEPTION 'INVALID_DEPARTMENT' USING ERRCODE = '22023';
      END IF;
    ELSE
      v_new_department := v_before.department_id;
    END IF;
    IF v_new_department IS NULL THEN
      RAISE EXCEPTION 'DEPARTMENT_REQUIRED' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF p_department_code IS NOT NULL THEN
      RAISE EXCEPTION 'DEPARTMENT_NOT_ALLOWED' USING ERRCODE = '22023';
    END IF;
    v_new_department := NULL;
  END IF;

  IF v_before.role = 'ADMIN' AND v_before.is_active
     AND (v_new_role <> 'ADMIN' OR NOT coalesce(p_is_active, v_before.is_active)) THEN
    SELECT count(*) INTO v_other_admins
      FROM public.app_users
     WHERE role = 'ADMIN' AND is_active AND id <> p_target_id;
    IF v_other_admins = 0 THEN
      RAISE EXCEPTION 'LAST_ADMIN' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.app_users
     SET role = v_new_role,
         department_id = v_new_department,
         is_active = coalesce(p_is_active, is_active)
   WHERE id = p_target_id
  RETURNING * INTO v_after;

  IF v_after.role IS DISTINCT FROM v_before.role
     OR v_after.department_id IS DISTINCT FROM v_before.department_id THEN
    INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
    VALUES (p_actor_id, 'USER_ROLE_CHANGED', 'APP_USER', p_target_id,
            jsonb_build_object(
              'before', v_before.role, 'after', v_after.role,
              'before_department', (SELECT code FROM public.departments WHERE id = v_before.department_id),
              'after_department', (SELECT code FROM public.departments WHERE id = v_after.department_id)),
            p_request_id);
  END IF;

  IF v_after.is_active IS DISTINCT FROM v_before.is_active THEN
    INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
    VALUES (p_actor_id,
            CASE WHEN v_after.is_active THEN 'USER_REACTIVATED' ELSE 'USER_DEACTIVATED' END,
            'APP_USER', p_target_id, '{}'::jsonb, p_request_id);
  END IF;

  RETURN v_after;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users(text, text, boolean, integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_update_user_access(uuid, uuid, text, boolean, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, boolean, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_user_access(uuid, uuid, text, boolean, text, text) TO service_role;

COMMIT;
