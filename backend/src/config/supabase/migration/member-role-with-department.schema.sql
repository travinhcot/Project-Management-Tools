-- Back to role MEMBER, with the department stored in app_users.department_id. Apply after
-- departments.schema.sql. Replaces member-department-roles.schema.sql (do not apply that one).
--
--   role IN ('ADMIN', 'DEPT_ADMIN', 'MEMBER')
--   ADMIN                -> department_id IS NULL      (EB super-admin: every department)
--   DEPT_ADMIN, MEMBER   -> department_id IS NOT NULL  (the department they belong to / run)
--
-- Works from either starting point:
--   * accounts still have role MEMBER (member-department-roles was never applied): they become TECH
--   * accounts have role TECH / HR / MARCOM (it was applied): each goes back to MEMBER and keeps
--     its department, taken from the old role
-- Nobody changes department by accident: an existing department_id is never overwritten.
BEGIN;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.departments WHERE code IN ('TECH', 'HR', 'MARCOM')) <> 3 THEN
    RAISE EXCEPTION 'Apply departments.schema.sql first: TECH, HR and MARCOM must exist.';
  END IF;
END;
$$;

-- =============================================================================
-- 1. Drop the role / department checks so the data can be reshaped
-- =============================================================================
-- By name first (the rule from departments.schema.sql says 'DEPT_ADMIN', which a search for the
-- word 'ADMIN' in quotes would miss) ...
ALTER TABLE public.app_users DROP CONSTRAINT IF EXISTS app_users_department_matches_role;
ALTER TABLE public.app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
-- ... then any other role check that is left under a different name.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.app_users'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%ADMIN%'
  LOOP
    EXECUTE format('ALTER TABLE public.app_users DROP CONSTRAINT %I', c.conname);
  END LOOP;
END;
$$;

-- =============================================================================
-- 2. THE UPDATE
-- =============================================================================
-- 2a. TECH / HR / MARCOM accounts -> MEMBER, keeping the department their role named
UPDATE public.app_users u
   SET department_id = d.id,
       role = 'MEMBER'
  FROM public.departments d
 WHERE u.role IN ('TECH', 'HR', 'MARCOM')
   AND d.code = u.role;

-- 2b. any MEMBER that still has no department -> TECH
UPDATE public.app_users
   SET department_id = (SELECT id FROM public.departments WHERE code = 'TECH')
 WHERE role = 'MEMBER' AND department_id IS NULL;

-- 2c. a super-admin has no department (safety net)
UPDATE public.app_users SET department_id = NULL WHERE role = 'ADMIN' AND department_id IS NOT NULL;

-- =============================================================================
-- 3. The rules
-- =============================================================================
ALTER TABLE public.app_users ALTER COLUMN role SET DEFAULT 'MEMBER';
ALTER TABLE public.app_users
  ADD CONSTRAINT app_users_role_check CHECK (role IN ('ADMIN', 'DEPT_ADMIN', 'MEMBER')),
  ADD CONSTRAINT app_users_department_matches_role CHECK ((role = 'ADMIN') = (department_id IS NULL));

CREATE INDEX IF NOT EXISTS app_users_department ON public.app_users (department_id) WHERE department_id IS NOT NULL;

-- A non-ADMIN account created without a department gets TECH (CHECKs run after BEFORE triggers).
CREATE OR REPLACE FUNCTION public.app_users_default_department()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.role <> 'ADMIN' AND NEW.department_id IS NULL THEN
    SELECT id INTO NEW.department_id FROM public.departments WHERE code = 'TECH';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS app_users_default_department ON public.app_users;
CREATE TRIGGER app_users_default_department
BEFORE INSERT ON public.app_users
FOR EACH ROW EXECUTE FUNCTION public.app_users_default_department();
REVOKE ALL ON FUNCTION public.app_users_default_department() FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 4. Users & access
-- =============================================================================
DROP FUNCTION IF EXISTS public.admin_list_users(text, text, boolean, integer, integer);
DROP FUNCTION IF EXISTS public.admin_list_users(text, text, boolean, integer, integer, text);
CREATE FUNCTION public.admin_list_users(
  p_search          text,
  p_role            text,
  p_is_active       boolean,
  p_limit           integer,
  p_offset          integer,
  p_department_code text DEFAULT NULL
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
     AND (p_department_code IS NULL OR d.code = p_department_code)
   ORDER BY u.created_at DESC, u.id
   LIMIT least(greatest(p_limit, 1), 100)
  OFFSET greatest(p_offset, 0);
$$;
REVOKE ALL ON FUNCTION public.admin_list_users(text, text, boolean, integer, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, boolean, integer, integer, text) TO service_role;

-- p_department_code:
--   new role ADMIN                 -> must be NULL; the department is cleared
--   new role DEPT_ADMIN or MEMBER  -> the given department, else the one the user already has;
--                                     a user coming from ADMIN has none, so it is then required
-- A department can be changed on its own (p_role NULL).
CREATE OR REPLACE FUNCTION public.admin_update_user_access(
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
  IF v_new_role = 'ADMIN' THEN
    IF p_department_code IS NOT NULL THEN
      RAISE EXCEPTION 'DEPARTMENT_NOT_ALLOWED' USING ERRCODE = '22023';
    END IF;
    v_new_department := NULL;
  ELSE
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
    VALUES (p_actor_id,
            CASE WHEN v_after.role IS DISTINCT FROM v_before.role
                 THEN 'USER_ROLE_CHANGED' ELSE 'USER_DEPARTMENT_CHANGED' END,
            'APP_USER', p_target_id,
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

-- =============================================================================
-- 5. Department resources: the department of a member's library is their account's department_id
--    (they must still be on the current roster). Skipped if department-resources.schema.sql is
--    not applied yet.
-- =============================================================================
DO $do$
BEGIN
  IF to_regprocedure('public.department_resource_scope(uuid, text)') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.department_resource_scope(p_actor_id uuid, p_department_code text)
      RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
      AS $body$
      DECLARE
        v_user public.app_users;
        v_department uuid;
      BEGIN
        SELECT * INTO v_user FROM public.app_users WHERE id = p_actor_id AND is_active;
        IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;

        IF v_user.role = 'ADMIN' THEN
          SELECT id INTO v_department FROM public.departments WHERE code = p_department_code;
          IF v_department IS NULL THEN RAISE EXCEPTION 'DEPARTMENT_REQUIRED' USING ERRCODE = '22023'; END IF;
          RETURN v_department;
        END IF;

        -- DEPT_ADMIN and MEMBER: the department on their account. A DEPT_ADMIN may name it;
        -- naming another one is refused.
        IF p_department_code IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM public.departments WHERE id = v_user.department_id AND code = p_department_code) THEN
          RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
        END IF;
        IF v_user.role = 'MEMBER' AND NOT EXISTS (SELECT 1 FROM public.member_eligibility(p_actor_id)) THEN
          RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';   -- not on the current roster
        END IF;
        RETURN v_user.department_id;
      END;
      $body$
    $fn$;
  END IF;
END;
$do$;

-- =============================================================================
-- 6. Check before committing
-- =============================================================================
DO $$
DECLARE v_bad bigint;
BEGIN
  SELECT count(*) INTO v_bad FROM public.app_users
   WHERE role NOT IN ('ADMIN', 'DEPT_ADMIN', 'MEMBER') OR (role = 'ADMIN') <> (department_id IS NULL);
  IF v_bad > 0 THEN RAISE EXCEPTION '% accounts break the role / department rule', v_bad; END IF;
END;
$$;

COMMIT;

-- Afterwards (read-only):
--   SELECT u.role, d.code AS department, count(*)
--     FROM public.app_users u LEFT JOIN public.departments d ON d.id = u.department_id
--    GROUP BY 1, 2 ORDER BY 1, 2;
-- Expect: ADMIN with no department; MEMBER and DEPT_ADMIN each with TECH / MARCOM / HR.
