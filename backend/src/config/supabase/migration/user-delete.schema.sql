-- Permanent deletion of a user account from Users & access. Apply after roster-member-delete.schema.sql.
--
-- Same rules as admin_delete_roster_member, started from the account instead of a roster entry:
-- removes the account's email deliveries, project assignments and roster entries (every semester),
-- then the app_users row. ADMIN accounts and the caller's own account are refused. If the account is
-- still referenced elsewhere (for example it acted in the audit log) the foreign key (23503) stops the
-- delete and the whole call rolls back. The caller deletes the Supabase auth user afterwards.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_delete_user(
  p_actor_id uuid, p_target_id uuid, p_request_id text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_account public.app_users;
  v_ids uuid[];
  v_projects bigint;
  v_deliveries bigint;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  SELECT * INTO v_account FROM public.app_users WHERE id = p_target_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_account.role = 'ADMIN' OR v_account.id = p_actor_id THEN
    RAISE EXCEPTION 'USER_IS_ADMIN' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(array_agg(m.id), '{}') INTO v_ids
    FROM public.roster_members m WHERE m.user_id = p_target_id;

  SELECT count(*) INTO v_projects FROM public.project_members WHERE roster_member_id = ANY (v_ids);
  SELECT count(*) INTO v_deliveries FROM public.email_deliveries WHERE roster_member_id = ANY (v_ids);

  DELETE FROM public.email_deliveries WHERE roster_member_id = ANY (v_ids);
  DELETE FROM public.project_members WHERE roster_member_id = ANY (v_ids);
  DELETE FROM public.roster_members WHERE id = ANY (v_ids);
  DELETE FROM public.app_users WHERE id = p_target_id;   -- 23503 if still referenced elsewhere

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'USER_DELETED', 'APP_USER', p_target_id,
          jsonb_build_object('role', v_account.role,
                             'roster_entries', cardinality(v_ids),
                             'projects_removed', v_projects,
                             'deliveries_removed', v_deliveries),
          p_request_id);
  RETURN p_target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid, uuid, text) TO service_role;

COMMIT;
