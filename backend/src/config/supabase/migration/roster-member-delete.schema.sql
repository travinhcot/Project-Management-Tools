-- Permanent deletion of a roster member. Apply after roster-major.schema.sql and project-members.schema.sql.
--
-- Removes, in order: the member's email deliveries, project assignments and roster entries (in EVERY
-- semester, because one login account can be linked to one entry per semester), then the app account.
-- Admin accounts are refused. If the account is still referenced elsewhere (for example it acted in the
-- audit log) the foreign key stops the delete and the whole call rolls back.
-- The caller deletes the matching Supabase auth user afterwards (app_users.id references auth.users).

BEGIN;

-- ---------- Impact (read-only preview for the confirmation dialog) ----------
CREATE OR REPLACE FUNCTION public.admin_roster_delete_impact(
  p_actor_id uuid, p_roster_member_id uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_member public.roster_members;
  v_account public.app_users;
  v_ids uuid[];
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  SELECT * INTO v_member FROM public.roster_members WHERE id = p_roster_member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROSTER_MEMBER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_member.user_id IS NOT NULL THEN
    SELECT * INTO v_account FROM public.app_users WHERE id = v_member.user_id;
  END IF;
  SELECT coalesce(array_agg(m.id), ARRAY[p_roster_member_id]) INTO v_ids
    FROM public.roster_members m
   WHERE m.id = p_roster_member_id
      OR (v_member.user_id IS NOT NULL AND m.user_id = v_member.user_id);

  RETURN jsonb_build_object(
    'full_name', v_member.full_name,
    'email', v_member.email,
    'has_account', v_account.id IS NOT NULL,
    'account_role', v_account.role,
    'roster_entries', cardinality(v_ids),
    'projects', (SELECT count(*) FROM public.project_members pm WHERE pm.roster_member_id = ANY (v_ids)),
    'deliveries', (SELECT count(*) FROM public.email_deliveries d WHERE d.roster_member_id = ANY (v_ids))
  );
END;
$$;

-- ---------- Delete ----------
-- Returns the auth user id to delete next (NULL when the member never signed in).
CREATE OR REPLACE FUNCTION public.admin_delete_roster_member(
  p_actor_id uuid, p_roster_member_id uuid, p_request_id text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_member public.roster_members;
  v_account public.app_users;
  v_ids uuid[];
  v_projects bigint;
  v_deliveries bigint;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  SELECT * INTO v_member FROM public.roster_members WHERE id = p_roster_member_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROSTER_MEMBER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_member.user_id IS NOT NULL THEN
    SELECT * INTO v_account FROM public.app_users WHERE id = v_member.user_id FOR UPDATE;
    IF v_account.role = 'ADMIN' THEN
      RAISE EXCEPTION 'MEMBER_IS_ADMIN' USING ERRCODE = 'P0001';
    END IF;
    IF v_account.id = p_actor_id THEN
      RAISE EXCEPTION 'MEMBER_IS_ADMIN' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT coalesce(array_agg(m.id), ARRAY[p_roster_member_id]) INTO v_ids
    FROM public.roster_members m
   WHERE m.id = p_roster_member_id
      OR (v_member.user_id IS NOT NULL AND m.user_id = v_member.user_id);

  SELECT count(*) INTO v_projects FROM public.project_members WHERE roster_member_id = ANY (v_ids);
  SELECT count(*) INTO v_deliveries FROM public.email_deliveries WHERE roster_member_id = ANY (v_ids);

  DELETE FROM public.email_deliveries WHERE roster_member_id = ANY (v_ids);
  DELETE FROM public.project_members WHERE roster_member_id = ANY (v_ids);
  DELETE FROM public.roster_members WHERE id = ANY (v_ids);
  IF v_account.id IS NOT NULL THEN
    DELETE FROM public.app_users WHERE id = v_account.id;   -- 23503 if still referenced elsewhere
  END IF;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'ROSTER_MEMBER_DELETED', 'ROSTER_MEMBER', p_roster_member_id,
          jsonb_build_object('semester_id', v_member.semester_id,
                             'roster_entries', cardinality(v_ids),
                             'projects_removed', v_projects,
                             'deliveries_removed', v_deliveries,
                             'account_deleted', v_account.id IS NOT NULL),
          p_request_id);
  RETURN v_account.id;
END;
$$;

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.admin_roster_delete_impact(uuid, uuid)',
    'public.admin_delete_roster_member(uuid, uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
