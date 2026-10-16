-- Meeting emails for DEPT_ADMIN. Apply after department-scope.schema.sql and the emails*.sql files.
--
-- A department admin sees and manages only campaigns of their own department's projects.
-- Demo campaigns (no project, semester-wide) stay ADMIN-only: admin_schedule_demo keeps
-- assert_admin_actor, and a scoped actor is refused on any campaign without a project.
--   * Writes: the functions below swap assert_admin_actor for assert_staff_actor (which sets the
--     department scope); the campaign-id ones also call assert_campaign_in_scope.
--     email_campaigns_scope_guard (department-scope.schema.sql) still guards the row writes.
--   * Reads: admin_list_campaigns / admin_list_deliveries take an explicit p_department_id.
BEGIN;

-- =============================================================================
-- 1. Scope check for a campaign addressed by id
-- =============================================================================
-- Call after assert_staff_actor. A missing campaign passes so the caller raises its own
-- CAMPAIGN_NOT_FOUND; an existing one outside the scope (or without a project) is refused.
CREATE FUNCTION public.assert_campaign_in_scope(p_campaign_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SET search_path = ''
AS $$
DECLARE
  v_scope uuid := public.current_department_scope();
  v_campaign public.email_campaigns;
  v_department uuid;
BEGIN
  IF v_scope IS NULL THEN RETURN; END IF;
  SELECT * INTO v_campaign FROM public.email_campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_campaign.project_id IS NULL THEN
    RAISE EXCEPTION 'OUT_OF_SCOPE' USING ERRCODE = '42501';
  END IF;
  SELECT department_id INTO v_department FROM public.projects WHERE id = v_campaign.project_id;
  PERFORM public.department_scope_check(v_department);
END;
$$;
REVOKE ALL ON FUNCTION public.assert_campaign_in_scope(uuid) FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 2. Opt the write functions in (done on the live definitions, like department-scope.schema.sql)
-- =============================================================================
DO $$
DECLARE
  r record;
  v_def text;
  v_by_campaign text[] := ARRAY[
    'admin_reschedule_campaign', 'admin_cancel_campaign', 'admin_retry_failed_deliveries',
    'admin_resolve_unknown_delivery', 'admin_resend_campaign', 'admin_send_campaign_now'
  ];
  v_by_project text[] := ARRAY['admin_schedule_kickoff', 'admin_schedule_project_resources'];
  v_seen text[] := '{}';
BEGIN
  FOR r IN
    SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = ANY (v_by_campaign || v_by_project)
  LOOP
    v_def := pg_get_functiondef(r.oid);
    IF position('PERFORM public.assert_admin_actor(p_actor_id);' IN v_def) = 0 THEN
      RAISE EXCEPTION 'Expected an admin assertion in %', r.proname;
    END IF;
    IF r.proname = ANY (v_by_campaign) THEN
      v_def := replace(v_def, 'PERFORM public.assert_admin_actor(p_actor_id);',
        'PERFORM public.assert_staff_actor(p_actor_id); PERFORM public.assert_campaign_in_scope(p_campaign_id);');
    ELSE
      v_def := replace(v_def, 'PERFORM public.assert_admin_actor(p_actor_id);',
        'PERFORM public.assert_staff_actor(p_actor_id);');
    END IF;
    EXECUTE v_def;
    v_seen := v_seen || r.proname::text;
  END LOOP;
  IF cardinality(ARRAY(SELECT DISTINCT unnest(v_seen))) <> cardinality(v_by_campaign || v_by_project) THEN
    RAISE EXCEPTION 'Not every function to scope exists; found %', v_seen;
  END IF;
END;
$$;

-- =============================================================================
-- 3. Reads: an explicit department filter (NULL = every department)
-- =============================================================================
DROP FUNCTION public.admin_list_campaigns(uuid, uuid, text, text, integer, integer);
CREATE FUNCTION public.admin_list_campaigns(
  p_campaign_id uuid, p_semester_id uuid, p_kind text, p_status text, p_limit integer, p_offset integer,
  p_department_id uuid DEFAULT NULL
) RETURNS TABLE (
  id uuid, semester_id uuid, semester_name text, project_id uuid, project_name text, kind text,
  status text, scheduled_at timestamptz, template_key text, template_version integer,
  subject_snapshot text, demo_registration_url text, parent_campaign_id uuid,
  created_by_user_id uuid, created_at timestamptz, started_at timestamptz, completed_at timestamptz,
  cancelled_at timestamptz, delivery_counts jsonb, estimated_recipients bigint, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.semester_id, s.name::text, c.project_id, p.name::text, c.kind,
         c.status, c.scheduled_at, c.template_key, c.template_version,
         c.subject_snapshot, s.demo_registration_url, c.parent_campaign_id,
         c.created_by_user_id, c.created_at, c.started_at, c.completed_at,
         c.cancelled_at,
         (SELECT coalesce(jsonb_object_agg(x.status, x.n), '{}'::jsonb)
            FROM (SELECT d.status, count(*) AS n FROM public.email_deliveries d
                   WHERE d.campaign_id = c.id GROUP BY d.status) x),
         CASE WHEN c.status IN ('DRAFT', 'SCHEDULED')
              THEN (SELECT count(*) FROM public.email_eligible_roster(c.id))
              ELSE (SELECT count(*) FROM public.email_deliveries d WHERE d.campaign_id = c.id) END,
         count(*) OVER ()
    FROM public.email_campaigns c
    JOIN public.semesters s ON s.id = c.semester_id
    LEFT JOIN public.projects p ON p.id = c.project_id
   WHERE (p_campaign_id IS NULL OR c.id = p_campaign_id)
     AND (p_semester_id IS NULL OR c.semester_id = p_semester_id)
     AND (p_kind IS NULL OR c.kind = p_kind)
     AND (p_status IS NULL OR c.status = p_status)
     AND (p_department_id IS NULL OR p.department_id = p_department_id)
   ORDER BY c.scheduled_at DESC, c.id
   LIMIT least(greatest(p_limit, 1), 100)
  OFFSET greatest(p_offset, 0);
END;
$$;

DROP FUNCTION public.admin_list_deliveries(uuid, text, text, integer, integer);
CREATE FUNCTION public.admin_list_deliveries(
  p_campaign_id uuid, p_status text, p_search text, p_limit integer, p_offset integer,
  p_department_id uuid DEFAULT NULL
) RETURNS TABLE (
  id uuid, roster_member_id uuid, full_name text, recipient_email text, status text,
  attempt_count integer, last_attempt_at timestamptz, sent_at timestamptz,
  next_attempt_at timestamptz, last_error_code text, last_error_summary text, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.roster_member_id, rm.full_name::text, d.recipient_email_snapshot::text, d.status,
         d.attempt_count, d.last_attempt_at, d.sent_at,
         d.next_attempt_at, d.last_error_code, d.last_error_summary, count(*) OVER ()
    FROM public.email_deliveries d
    LEFT JOIN public.roster_members rm ON rm.id = d.roster_member_id
   WHERE d.campaign_id = p_campaign_id
     AND (p_department_id IS NULL OR EXISTS (
           SELECT 1 FROM public.email_campaigns c
             JOIN public.projects p ON p.id = c.project_id
            WHERE c.id = d.campaign_id AND p.department_id = p_department_id))
     AND (p_status IS NULL OR d.status = p_status)
     AND (p_search IS NULL
          OR strpos(lower(d.recipient_email_snapshot), lower(p_search)) > 0
          OR strpos(lower(coalesce(rm.full_name, '')), lower(p_search)) > 0)
   ORDER BY lower(d.recipient_email_snapshot), d.id
   LIMIT least(greatest(p_limit, 1), 100)
  OFFSET greatest(p_offset, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_campaigns(uuid, uuid, text, text, integer, integer, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_campaigns(uuid, uuid, text, text, integer, integer, uuid)
  TO service_role;
REVOKE ALL ON FUNCTION public.admin_list_deliveries(uuid, text, text, integer, integer, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_deliveries(uuid, text, text, integer, integer, uuid)
  TO service_role;

COMMIT;
