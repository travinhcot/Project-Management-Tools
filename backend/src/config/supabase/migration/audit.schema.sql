-- Audit log (FR-AUD-01). Apply after platform-tables, semesters-roster, user-management,
-- projects, files and emails (they already INSERT into audit_events from their own functions).
-- Owner: audit. Every module's SQL function may keep inserting rows; this file makes the
-- table append-only, strips sensitive metadata, and adds the admin read / retention functions.
-- Callable by the backend (service_role) only.
BEGIN;

-- =============================================================================
-- 1. Columns and indexes (SRS 7.3: semester_id, time/actor/entity indexes)
-- =============================================================================
ALTER TABLE public.audit_events
  ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES public.semesters(id) ON DELETE RESTRICT;

-- Backfill from the metadata the older functions wrote. Runs before the append-only guard exists.
UPDATE public.audit_events a
   SET semester_id = (a.metadata ->> 'semester_id')::uuid
 WHERE a.semester_id IS NULL
   AND a.metadata ->> 'semester_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   AND EXISTS (SELECT 1 FROM public.semesters s WHERE s.id = (a.metadata ->> 'semester_id')::uuid);

DROP INDEX IF EXISTS public.audit_events_time;
DROP INDEX IF EXISTS public.audit_events_actor_time;
CREATE INDEX IF NOT EXISTS audit_events_time_desc ON public.audit_events (occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS audit_events_actor_time_desc ON public.audit_events (actor_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_entity ON public.audit_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_events_action_time ON public.audit_events (action, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_semester_time ON public.audit_events (semester_id, occurred_at DESC)
  WHERE semester_id IS NOT NULL;

-- =============================================================================
-- 2. Metadata hygiene: never keep OTPs, tokens, cookies, signed URLs, keys, email bodies.
--    Strips (does not reject) so an audited business action is never blocked by a bad key.
-- =============================================================================
CREATE FUNCTION public.audit_strip_sensitive(p_value jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE v_result jsonb;
BEGIN
  IF p_value IS NULL THEN RETURN NULL; END IF;
  IF jsonb_typeof(p_value) = 'object' THEN
    SELECT coalesce(jsonb_object_agg(e.key, public.audit_strip_sensitive(e.value)), '{}'::jsonb)
      INTO v_result
      FROM jsonb_each(p_value) e
     WHERE e.key !~* '(otp|token|cookie|passw|secret|signed|api_?key|authorization|credential|body|html)';
    RETURN v_result;
  ELSIF jsonb_typeof(p_value) = 'array' THEN
    SELECT coalesce(jsonb_agg(public.audit_strip_sensitive(e.value)), '[]'::jsonb)
      INTO v_result FROM jsonb_array_elements(p_value) e;
    RETURN v_result;
  END IF;
  RETURN p_value;
END;
$$;

CREATE FUNCTION public.audit_events_prepare_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.metadata := public.audit_strip_sensitive(NEW.metadata);
  -- Older functions pass the semester only inside metadata.
  IF NEW.semester_id IS NULL
     AND NEW.metadata ->> 'semester_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     AND EXISTS (SELECT 1 FROM public.semesters s WHERE s.id = (NEW.metadata ->> 'semester_id')::uuid) THEN
    NEW.semester_id := (NEW.metadata ->> 'semester_id')::uuid;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER audit_events_prepare_insert BEFORE INSERT ON public.audit_events
FOR EACH ROW EXECUTE FUNCTION public.audit_events_prepare_insert();

-- =============================================================================
-- 3. Append-only: no UPDATE/TRUNCATE ever; DELETE only inside audit_purge_expired().
-- =============================================================================
CREATE FUNCTION public.audit_events_guard_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('audit.purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_events is append-only' USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER audit_events_no_update_delete BEFORE UPDATE OR DELETE ON public.audit_events
FOR EACH ROW EXECUTE FUNCTION public.audit_events_guard_append_only();
CREATE TRIGGER audit_events_no_truncate BEFORE TRUNCATE ON public.audit_events
FOR EACH STATEMENT EXECUTE FUNCTION public.audit_events_guard_append_only();

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_events FROM service_role;
GRANT SELECT, INSERT ON TABLE public.audit_events TO service_role;

-- =============================================================================
-- 4. Record (system path: sign-in/out events have no admin actor)
-- =============================================================================
CREATE FUNCTION public.audit_record_event(
  p_actor_id uuid, p_action text, p_entity_type text, p_entity_id uuid,
  p_semester_id uuid, p_metadata jsonb, p_request_id text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF p_action !~ '^[A-Z][A-Z0-9_]{1,63}$' OR p_entity_type !~ '^[A-Z][A-Z0-9_]{1,63}$' THEN
    RAISE EXCEPTION 'INVALID_AUDIT_EVENT' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, semester_id, metadata, request_id)
  VALUES (p_actor_id, p_action, p_entity_type, p_entity_id, p_semester_id,
          coalesce(p_metadata, '{}'::jsonb), left(p_request_id, 100))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- =============================================================================
-- 5. Admin reads
-- =============================================================================
CREATE FUNCTION public.admin_list_audit_events(
  p_actor_id uuid, p_filter_actor uuid, p_action text, p_entity_type text, p_entity_id uuid,
  p_semester_id uuid, p_from timestamptz, p_to timestamptz, p_limit integer, p_offset integer
) RETURNS TABLE (
  id uuid, actor_user_id uuid, actor_email text, actor_name text, action text, entity_type text,
  entity_id uuid, semester_id uuid, metadata jsonb, request_id text, occurred_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  RETURN QUERY
  SELECT e.id, e.actor_user_id, u.email::text, u.full_name::text, e.action, e.entity_type,
         e.entity_id, e.semester_id, e.metadata, e.request_id, e.occurred_at,
         count(*) OVER ()
    FROM public.audit_events e
    LEFT JOIN public.app_users u ON u.id = e.actor_user_id
   WHERE (p_filter_actor IS NULL OR e.actor_user_id = p_filter_actor)
     AND (p_action IS NULL OR e.action = p_action)
     AND (p_entity_type IS NULL OR e.entity_type = p_entity_type)
     AND (p_entity_id IS NULL OR e.entity_id = p_entity_id)
     AND (p_semester_id IS NULL OR e.semester_id = p_semester_id)
     AND (p_from IS NULL OR e.occurred_at >= p_from)
     AND (p_to IS NULL OR e.occurred_at < p_to)
   ORDER BY e.occurred_at DESC, e.id DESC
   LIMIT p_limit OFFSET p_offset;
END;
$$;

CREATE FUNCTION public.admin_get_audit_event(p_actor_id uuid, p_event_id uuid)
RETURNS TABLE (
  id uuid, actor_user_id uuid, actor_email text, actor_name text, action text, entity_type text,
  entity_id uuid, semester_id uuid, metadata jsonb, request_id text, occurred_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  RETURN QUERY
  SELECT e.id, e.actor_user_id, u.email::text, u.full_name::text, e.action, e.entity_type,
         e.entity_id, e.semester_id, e.metadata, e.request_id, e.occurred_at
    FROM public.audit_events e
    LEFT JOIN public.app_users u ON u.id = e.actor_user_id
   WHERE e.id = p_event_id;
END;
$$;

CREATE FUNCTION public.admin_audit_filter_values(p_actor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  RETURN jsonb_build_object(
    'actions', coalesce((SELECT jsonb_agg(a ORDER BY a) FROM (SELECT DISTINCT action AS a FROM public.audit_events) s), '[]'::jsonb),
    'entity_types', coalesce((SELECT jsonb_agg(t ORDER BY t) FROM (SELECT DISTINCT entity_type AS t FROM public.audit_events) s), '[]'::jsonb)
  );
END;
$$;

-- =============================================================================
-- 6. Retention (D-11). Deletes at most p_limit rows older than p_older_than and records the purge.
-- =============================================================================
CREATE FUNCTION public.audit_purge_expired(p_older_than interval, p_limit integer, p_request_id text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_cutoff timestamptz; v_deleted integer;
BEGIN
  IF p_older_than < interval '30 days' OR p_limit < 1 THEN
    RAISE EXCEPTION 'INVALID_RETENTION' USING ERRCODE = '22023';
  END IF;
  v_cutoff := now() - p_older_than;
  PERFORM set_config('audit.purge', 'on', true);   -- transaction-local; lets the guard allow DELETE
  WITH doomed AS (
    SELECT id FROM public.audit_events WHERE occurred_at < v_cutoff
     ORDER BY occurred_at LIMIT p_limit FOR UPDATE SKIP LOCKED
  ), gone AS (
    DELETE FROM public.audit_events e USING doomed d WHERE e.id = d.id RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM gone;
  PERFORM set_config('audit.purge', 'off', true);
  IF v_deleted > 0 THEN
    INSERT INTO public.audit_events (actor_user_id, action, entity_type, metadata, request_id)
    VALUES (NULL, 'AUDIT_RETENTION_PURGED', 'AUDIT',
            jsonb_build_object('deleted', v_deleted, 'cutoff', v_cutoff), p_request_id);
  END IF;
  RETURN v_deleted;
END;
$$;

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.audit_strip_sensitive(jsonb)',
    'public.audit_events_prepare_insert()',
    'public.audit_events_guard_append_only()',
    'public.audit_record_event(uuid, text, text, uuid, uuid, jsonb, text)',
    'public.admin_list_audit_events(uuid, uuid, text, text, uuid, uuid, timestamptz, timestamptz, integer, integer)',
    'public.admin_get_audit_event(uuid, uuid)',
    'public.admin_audit_filter_values(uuid)',
    'public.audit_purge_expired(interval, integer, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[
    'public.audit_record_event(uuid, text, text, uuid, uuid, jsonb, text)',
    'public.admin_list_audit_events(uuid, uuid, text, text, uuid, uuid, timestamptz, timestamptz, integer, integer)',
    'public.admin_get_audit_event(uuid, uuid)',
    'public.admin_audit_filter_values(uuid)',
    'public.audit_purge_expired(interval, integer, text)'
  ] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
