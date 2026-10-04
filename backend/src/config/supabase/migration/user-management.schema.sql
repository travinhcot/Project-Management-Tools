-- User management (FR-USR-01, FR-USR-02). Apply after app-user.schema.sql and
-- platform-tables.schema.sql. Both functions are callable by the backend
-- (service_role) only.
BEGIN;

-- List users for admins. Joins auth.users for last_sign_in_at (tracked by
-- Supabase Auth), so no extra column is needed. Search is parameterized and uses
-- strpos, so LIKE wildcards in user input have no special meaning.
CREATE FUNCTION public.admin_list_users(
  p_search    text,
  p_role      text,
  p_is_active boolean,
  p_limit     integer,
  p_offset    integer
) RETURNS TABLE (
  id uuid, email varchar, full_name varchar, role text, is_active boolean,
  last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz,
  total_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT u.id, u.email, u.full_name, u.role, u.is_active,
         a.last_sign_in_at, u.created_at, u.updated_at,
         count(*) OVER () AS total_count
    FROM public.app_users u
    JOIN auth.users a ON a.id = u.id
   WHERE (p_search IS NULL
          OR strpos(u.normalized_email, lower(p_search)) > 0
          OR strpos(lower(u.full_name), lower(p_search)) > 0)
     AND (p_role IS NULL OR u.role = p_role)
     AND (p_is_active IS NULL OR u.is_active = p_is_active)
   ORDER BY u.created_at DESC, u.id
   LIMIT least(greatest(p_limit, 1), 100)
  OFFSET greatest(p_offset, 0);
$$;

-- Change role and/or activation. Keeps at least one active admin (serialized by
-- an advisory lock) and writes audit rows in the same transaction.
CREATE FUNCTION public.admin_update_user_access(
  p_actor_id   uuid,
  p_target_id  uuid,
  p_role       text    DEFAULT NULL,
  p_is_active  boolean DEFAULT NULL,
  p_request_id text    DEFAULT NULL
) RETURNS public.app_users
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_before public.app_users;
  v_after  public.app_users;
  v_other_admins integer;
BEGIN
  IF p_role IS NULL AND p_is_active IS NULL THEN
    RAISE EXCEPTION 'NO_CHANGES' USING ERRCODE = '22023';
  END IF;
  IF p_role IS NOT NULL AND p_role NOT IN ('ADMIN', 'MEMBER') THEN
    RAISE EXCEPTION 'INVALID_ROLE' USING ERRCODE = '22023';
  END IF;

  -- Serialize every change to the admin set (two admins demoting each other at once).
  PERFORM pg_advisory_xact_lock(hashtext('app_users.admin_set'));

  -- Re-check the caller after the lock, so an actor demoted a moment ago is rejected.
  IF NOT EXISTS (SELECT 1 FROM public.app_users
                  WHERE id = p_actor_id AND role = 'ADMIN' AND is_active) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_before FROM public.app_users WHERE id = p_target_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_before.role = 'ADMIN' AND v_before.is_active
     AND (coalesce(p_role, v_before.role) <> 'ADMIN'
          OR NOT coalesce(p_is_active, v_before.is_active)) THEN
    SELECT count(*) INTO v_other_admins
      FROM public.app_users
     WHERE role = 'ADMIN' AND is_active AND id <> p_target_id;
    IF v_other_admins = 0 THEN
      RAISE EXCEPTION 'LAST_ADMIN' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- updated_at is set by the existing prepare_app_user trigger.
  UPDATE public.app_users
     SET role = coalesce(p_role, role),
         is_active = coalesce(p_is_active, is_active)
   WHERE id = p_target_id
  RETURNING * INTO v_after;

  IF v_after.role IS DISTINCT FROM v_before.role THEN
    INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
    VALUES (p_actor_id, 'USER_ROLE_CHANGED', 'APP_USER', p_target_id,
            jsonb_build_object('before', v_before.role, 'after', v_after.role), p_request_id);
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

-- Backend (service_role) only. Supabase grants EXECUTE to anon/authenticated by default.
REVOKE ALL ON FUNCTION public.admin_list_users(text, text, boolean, integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_update_user_access(uuid, uuid, text, boolean, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, boolean, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_user_access(uuid, uuid, text, boolean, text) TO service_role;

COMMIT;
