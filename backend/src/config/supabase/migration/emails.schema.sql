-- Email campaigns (FR-EML-01..04). Apply after platform-tables, semesters-roster, projects,
-- project-members. ALTER-based: safe on a DB that already has seed campaigns.
BEGIN;

-- =============================================================================
-- 1. Tables (owned by: emails)
-- =============================================================================
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS subject_snapshot text,
  ADD COLUMN IF NOT EXISTS parent_campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by_user_id uuid REFERENCES public.app_users(id) ON DELETE RESTRICT;

-- One active (not cancelled, not finished) kick-off per project and demo per semester.
CREATE UNIQUE INDEX IF NOT EXISTS email_campaigns_one_active_kickoff
  ON public.email_campaigns (project_id)
  WHERE kind = 'KICKOFF' AND status IN ('DRAFT', 'SCHEDULED', 'PROCESSING');
CREATE UNIQUE INDEX IF NOT EXISTS email_campaigns_one_active_demo
  ON public.email_campaigns (semester_id)
  WHERE kind = 'DEMO' AND status IN ('DRAFT', 'SCHEDULED', 'PROCESSING');

ALTER TABLE public.email_deliveries
  DROP CONSTRAINT IF EXISTS email_deliveries_status_check,
  ADD CONSTRAINT email_deliveries_status_check CHECK (status IN
    ('PENDING', 'SENDING', 'SENT', 'FAILED_RETRYABLE', 'FAILED_PERMANENT', 'UNKNOWN', 'SKIPPED')),
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
CREATE INDEX IF NOT EXISTS email_deliveries_lease
  ON public.email_deliveries (status, lease_expires_at) WHERE status = 'SENDING';
CREATE INDEX IF NOT EXISTS email_deliveries_by_campaign
  ON public.email_deliveries (campaign_id, status);

-- =============================================================================
-- 2. Recipient rules. Recipients are resolved from the roster at processing time.
--    Reads roster_members / project_members (owned elsewhere) the same way
--    portal.schema.sql does.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.email_eligible_roster(p_campaign_id uuid)
RETURNS TABLE (member_id uuid, member_email text, member_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT rm.id, rm.email::text, rm.full_name::text
    FROM public.email_campaigns c
    JOIN public.roster_members rm ON rm.semester_id = c.semester_id AND rm.status = 'ACTIVE'
   WHERE c.id = p_campaign_id
     AND (c.kind = 'DEMO' OR EXISTS (
            SELECT 1 FROM public.project_members pm
             WHERE pm.project_id = c.project_id AND pm.roster_member_id = rm.id
               AND pm.removed_at IS NULL));
$$;

CREATE OR REPLACE FUNCTION public.email_is_eligible(p_campaign_id uuid, p_roster_member_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.email_eligible_roster(p_campaign_id) e
                  WHERE e.member_id = p_roster_member_id);
$$;

CREATE OR REPLACE FUNCTION public.email_materialize_campaign(p_campaign_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO public.email_deliveries
    (campaign_id, semester_id, roster_member_id, recipient_email_snapshot, status)
  SELECT c.id, c.semester_id, e.member_id, e.member_email, 'PENDING'
    FROM public.email_campaigns c
   CROSS JOIN LATERAL public.email_eligible_roster(c.id) e
   WHERE c.id = p_campaign_id
  ON CONFLICT (campaign_id, roster_member_id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Settle a campaign once no delivery is open. Safe to call repeatedly.
CREATE OR REPLACE FUNCTION public.email_finalize_campaign(p_campaign_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_campaign public.email_campaigns; v_next text; v_counts jsonb;
BEGIN
  SELECT * INTO v_campaign FROM public.email_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_campaign.status NOT IN ('PROCESSING', 'COMPLETED', 'COMPLETED_WITH_FAILURES') THEN
    RETURN v_campaign.status;
  END IF;
  IF EXISTS (SELECT 1 FROM public.email_deliveries d
              WHERE d.campaign_id = p_campaign_id
                AND d.status IN ('PENDING', 'SENDING', 'FAILED_RETRYABLE')) THEN
    RETURN v_campaign.status;
  END IF;

  v_next := CASE WHEN EXISTS (SELECT 1 FROM public.email_deliveries d
                               WHERE d.campaign_id = p_campaign_id
                                 AND d.status IN ('FAILED_PERMANENT', 'UNKNOWN'))
                 THEN 'COMPLETED_WITH_FAILURES' ELSE 'COMPLETED' END;
  IF v_next <> v_campaign.status THEN
    UPDATE public.email_campaigns
       SET status = v_next, completed_at = now()
     WHERE id = p_campaign_id;
    SELECT coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb) INTO v_counts
      FROM (SELECT d.status, count(*) AS n FROM public.email_deliveries d
             WHERE d.campaign_id = p_campaign_id GROUP BY d.status) s;
    INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata)
    VALUES (NULL, 'EMAIL_CAMPAIGN_COMPLETED', 'EMAIL_CAMPAIGN', p_campaign_id,
            jsonb_build_object('semester_id', v_campaign.semester_id, 'status', v_next, 'deliveries', v_counts));
  END IF;
  RETURN v_next;
END;
$$;

-- =============================================================================
-- 3. Admin functions
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_schedule_kickoff(
  p_actor_id uuid, p_project_id uuid, p_scheduled_at timestamptz, p_request_id text
) RETURNS public.email_campaigns
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_project public.projects; v_row public.email_campaigns; v_id uuid := gen_random_uuid();
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_project.archived_at IS NOT NULL THEN RAISE EXCEPTION 'PROJECT_ARCHIVED' USING ERRCODE = 'P0001'; END IF;
  IF p_scheduled_at IS NULL OR p_scheduled_at <= now() THEN
    RAISE EXCEPTION 'SCHEDULE_IN_PAST' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.email_campaigns c
              WHERE c.project_id = p_project_id AND c.kind = 'KICKOFF'
                AND c.status IN ('DRAFT', 'SCHEDULED', 'PROCESSING')) THEN
    RAISE EXCEPTION 'CAMPAIGN_EXISTS' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.email_campaigns
    (id, semester_id, project_id, kind, scheduled_at, template_key, template_version, status,
     idempotency_key, created_by_user_id, subject_snapshot)
  VALUES (v_id, v_project.semester_id, p_project_id, 'KICKOFF', p_scheduled_at, 'project-kickoff', 1,
          'SCHEDULED', 'kickoff:' || v_id::text, p_actor_id,
          'Project kick-off: ' || v_project.name || ' | Khởi động dự án: ' || v_project.name)
  RETURNING * INTO v_row;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'EMAIL_CAMPAIGN_SCHEDULED', 'EMAIL_CAMPAIGN', v_row.id,
          jsonb_build_object('semester_id', v_row.semester_id, 'project_id', p_project_id,
                             'kind', 'KICKOFF', 'scheduled_at', v_row.scheduled_at),
          p_request_id);
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_schedule_demo(
  p_actor_id uuid, p_semester_id uuid, p_scheduled_at timestamptz, p_request_id text
) RETURNS public.email_campaigns
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_semester public.semesters; v_row public.email_campaigns; v_id uuid := gen_random_uuid();
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  SELECT * INTO v_semester FROM public.semesters WHERE id = p_semester_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SEMESTER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_semester.demo_registration_url IS NULL THEN
    RAISE EXCEPTION 'DEMO_URL_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF p_scheduled_at IS NULL OR p_scheduled_at <= now() THEN
    RAISE EXCEPTION 'SCHEDULE_IN_PAST' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.email_campaigns c
              WHERE c.semester_id = p_semester_id AND c.kind = 'DEMO'
                AND c.status IN ('DRAFT', 'SCHEDULED', 'PROCESSING')) THEN
    RAISE EXCEPTION 'CAMPAIGN_EXISTS' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.email_campaigns
    (id, semester_id, project_id, kind, scheduled_at, template_key, template_version, status,
     idempotency_key, created_by_user_id, subject_snapshot)
  VALUES (v_id, p_semester_id, NULL, 'DEMO', p_scheduled_at, 'semester-demo', 1,
          'SCHEDULED', 'demo:' || v_id::text, p_actor_id,
          'Demo registration: ' || v_semester.name || ' | Đăng ký demo: ' || v_semester.name)
  RETURNING * INTO v_row;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'EMAIL_CAMPAIGN_SCHEDULED', 'EMAIL_CAMPAIGN', v_row.id,
          jsonb_build_object('semester_id', v_row.semester_id, 'kind', 'DEMO',
                             'scheduled_at', v_row.scheduled_at),
          p_request_id);
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reschedule_campaign(
  p_actor_id uuid, p_campaign_id uuid, p_scheduled_at timestamptz, p_request_id text
) RETURNS public.email_campaigns
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_before public.email_campaigns; v_row public.email_campaigns;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  SELECT * INTO v_before FROM public.email_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CAMPAIGN_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_before.status <> 'SCHEDULED' THEN
    RAISE EXCEPTION 'CAMPAIGN_NOT_RESCHEDULABLE' USING ERRCODE = 'P0001';
  END IF;
  IF p_scheduled_at IS NULL OR p_scheduled_at <= now() THEN
    RAISE EXCEPTION 'SCHEDULE_IN_PAST' USING ERRCODE = '22023';
  END IF;

  UPDATE public.email_campaigns SET scheduled_at = p_scheduled_at
   WHERE id = p_campaign_id RETURNING * INTO v_row;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'EMAIL_CAMPAIGN_RESCHEDULED', 'EMAIL_CAMPAIGN', v_row.id,
          jsonb_build_object('semester_id', v_row.semester_id, 'kind', v_row.kind,
                             'before', v_before.scheduled_at, 'after', v_row.scheduled_at),
          p_request_id);
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_campaign(
  p_actor_id uuid, p_campaign_id uuid, p_request_id text
) RETURNS public.email_campaigns
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_before public.email_campaigns; v_row public.email_campaigns;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  SELECT * INTO v_before FROM public.email_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CAMPAIGN_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_before.status NOT IN ('DRAFT', 'SCHEDULED') THEN
    RAISE EXCEPTION 'CAMPAIGN_NOT_CANCELLABLE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.email_campaigns
     SET status = 'CANCELLED', cancelled_at = now(), cancelled_by_user_id = p_actor_id
   WHERE id = p_campaign_id RETURNING * INTO v_row;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'EMAIL_CAMPAIGN_CANCELLED', 'EMAIL_CAMPAIGN', v_row.id,
          jsonb_strip_nulls(jsonb_build_object('semester_id', v_row.semester_id, 'kind', v_row.kind,
                                               'project_id', v_row.project_id)),
          p_request_id);
  RETURN v_row;
END;
$$;

-- Requeue FAILED_* rows only. SENT, UNKNOWN and SKIPPED rows are never touched.
CREATE OR REPLACE FUNCTION public.admin_retry_failed_deliveries(
  p_actor_id uuid, p_campaign_id uuid, p_request_id text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_campaign public.email_campaigns; v_count integer;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  SELECT * INTO v_campaign FROM public.email_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CAMPAIGN_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_campaign.status NOT IN ('COMPLETED_WITH_FAILURES', 'PROCESSING') THEN
    RAISE EXCEPTION 'CAMPAIGN_NOT_RETRYABLE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.email_deliveries d
     SET status = 'PENDING', attempt_count = 0, next_attempt_at = now(), lease_expires_at = NULL
   WHERE d.campaign_id = p_campaign_id AND d.status IN ('FAILED_RETRYABLE', 'FAILED_PERMANENT');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN RAISE EXCEPTION 'NO_FAILED_DELIVERIES' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.email_campaigns SET status = 'PROCESSING', completed_at = NULL
   WHERE id = p_campaign_id AND status <> 'PROCESSING';

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'EMAIL_DELIVERIES_RETRIED', 'EMAIL_CAMPAIGN', p_campaign_id,
          jsonb_build_object('semester_id', v_campaign.semester_id, 'requeued', v_count),
          p_request_id);
  RETURN v_count;
END;
$$;

-- p_action: 'MARK_SENT' (operator confirmed the mail went out) or 'RETRY'.
CREATE OR REPLACE FUNCTION public.admin_resolve_unknown_delivery(
  p_actor_id uuid, p_campaign_id uuid, p_delivery_id uuid, p_action text, p_request_id text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_campaign public.email_campaigns; v_delivery public.email_deliveries; v_status text;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  IF p_action IS NULL OR p_action NOT IN ('MARK_SENT', 'RETRY') THEN
    RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_campaign FROM public.email_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CAMPAIGN_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_delivery FROM public.email_deliveries
   WHERE id = p_delivery_id AND campaign_id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DELIVERY_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_delivery.status <> 'UNKNOWN' THEN
    RAISE EXCEPTION 'DELIVERY_NOT_UNKNOWN' USING ERRCODE = 'P0001';
  END IF;

  IF p_action = 'MARK_SENT' THEN
    UPDATE public.email_deliveries
       SET status = 'SENT', sent_at = now(), lease_expires_at = NULL,
           last_error_code = NULL, last_error_summary = NULL
     WHERE id = p_delivery_id;
    v_status := public.email_finalize_campaign(p_campaign_id);
  ELSE
    UPDATE public.email_deliveries
       SET status = 'PENDING', attempt_count = 0, next_attempt_at = now(), lease_expires_at = NULL
     WHERE id = p_delivery_id;
    UPDATE public.email_campaigns SET status = 'PROCESSING', completed_at = NULL
     WHERE id = p_campaign_id AND status <> 'PROCESSING';
    v_status := 'PROCESSING';
  END IF;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'EMAIL_DELIVERY_RESOLVED', 'EMAIL_CAMPAIGN', p_campaign_id,
          jsonb_build_object('semester_id', v_campaign.semester_id, 'delivery_id', p_delivery_id,
                             'action', p_action),
          p_request_id);
  RETURN v_status;
END;
$$;

-- "Resend to everyone": a NEW campaign pointing at the old one; the old one is never changed.
CREATE OR REPLACE FUNCTION public.admin_resend_campaign(
  p_actor_id uuid, p_campaign_id uuid, p_request_id text
) RETURNS public.email_campaigns
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_source public.email_campaigns; v_row public.email_campaigns; v_id uuid := gen_random_uuid();
  v_project public.projects; v_semester public.semesters;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  SELECT * INTO v_source FROM public.email_campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CAMPAIGN_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_source.status NOT IN ('COMPLETED', 'COMPLETED_WITH_FAILURES') THEN
    RAISE EXCEPTION 'CAMPAIGN_NOT_RESENDABLE' USING ERRCODE = 'P0001';
  END IF;

  IF v_source.kind = 'KICKOFF' THEN
    SELECT * INTO v_project FROM public.projects WHERE id = v_source.project_id FOR UPDATE;
    IF v_project.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'PROJECT_ARCHIVED' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    SELECT * INTO v_semester FROM public.semesters WHERE id = v_source.semester_id FOR UPDATE;
    IF v_semester.demo_registration_url IS NULL THEN
      RAISE EXCEPTION 'DEMO_URL_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.email_campaigns c
              WHERE c.kind = v_source.kind AND c.semester_id = v_source.semester_id
                AND c.project_id IS NOT DISTINCT FROM v_source.project_id
                AND c.status IN ('DRAFT', 'SCHEDULED', 'PROCESSING')) THEN
    RAISE EXCEPTION 'CAMPAIGN_EXISTS' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.email_campaigns
    (id, semester_id, project_id, kind, scheduled_at, template_key, template_version, status,
     idempotency_key, created_by_user_id, subject_snapshot, parent_campaign_id)
  VALUES (v_id, v_source.semester_id, v_source.project_id, v_source.kind, now(),
          v_source.template_key, v_source.template_version, 'SCHEDULED',
          'resend:' || v_id::text, p_actor_id, v_source.subject_snapshot, v_source.id)
  RETURNING * INTO v_row;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'EMAIL_CAMPAIGN_RESENT', 'EMAIL_CAMPAIGN', v_row.id,
          jsonb_strip_nulls(jsonb_build_object('semester_id', v_row.semester_id, 'kind', v_row.kind,
                                               'project_id', v_row.project_id,
                                               'parent_campaign_id', v_source.id)),
          p_request_id);
  RETURN v_row;
END;
$$;

-- ---------- Reads ----------
-- Any filter may be NULL. Delivery counts and the recipient estimate ride along (no N+1).
CREATE OR REPLACE FUNCTION public.admin_list_campaigns(
  p_campaign_id uuid, p_semester_id uuid, p_kind text, p_status text, p_limit integer, p_offset integer
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
   ORDER BY c.scheduled_at DESC, c.id
   LIMIT least(greatest(p_limit, 1), 100)
  OFFSET greatest(p_offset, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_deliveries(
  p_campaign_id uuid, p_status text, p_search text, p_limit integer, p_offset integer
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
     AND (p_status IS NULL OR d.status = p_status)
     AND (p_search IS NULL
          OR strpos(lower(d.recipient_email_snapshot), lower(p_search)) > 0
          OR strpos(lower(coalesce(rm.full_name, '')), lower(p_search)) > 0)
   ORDER BY lower(d.recipient_email_snapshot), d.id
   LIMIT least(greatest(p_limit, 1), 100)
  OFFSET greatest(p_offset, 0);
END;
$$;

-- =============================================================================
-- 4. Processor functions (no human actor: audit rows carry actor_user_id NULL)
-- =============================================================================
-- Move due SCHEDULED campaigns to PROCESSING and create their delivery rows.
CREATE OR REPLACE FUNCTION public.email_claim_due_campaigns(p_limit integer)
RETURNS TABLE (claimed_campaign_id uuid, recipient_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_campaign public.email_campaigns; v_count integer;
BEGIN
  FOR v_campaign IN
    SELECT c.* FROM public.email_campaigns c
     WHERE c.status = 'SCHEDULED' AND c.scheduled_at <= now()
     ORDER BY c.scheduled_at, c.id
     LIMIT least(greatest(p_limit, 1), 50)
       FOR UPDATE OF c SKIP LOCKED
  LOOP
    UPDATE public.email_campaigns SET status = 'PROCESSING', started_at = now()
     WHERE id = v_campaign.id;
    v_count := public.email_materialize_campaign(v_campaign.id);
    INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata)
    VALUES (NULL, 'EMAIL_CAMPAIGN_STARTED', 'EMAIL_CAMPAIGN', v_campaign.id,
            jsonb_build_object('semester_id', v_campaign.semester_id, 'kind', v_campaign.kind,
                               'recipients', v_count));
    claimed_campaign_id := v_campaign.id;
    recipient_count := v_count;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Atomically claim a batch of due deliveries (SKIP LOCKED + lease). Expired leases are
-- reclaimed; recipients who are no longer eligible become SKIPPED instead of being sent.
CREATE OR REPLACE FUNCTION public.email_claim_due_deliveries(p_limit integer, p_lease_seconds integer)
RETURNS TABLE (
  delivery_id uuid, campaign_id uuid, kind text, template_key text, template_version integer,
  subject text, recipient_email text, recipient_name text, project_id uuid, project_name text,
  semester_name text, demo_registration_url text, attempt_count integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ids uuid[];
BEGIN
  SELECT coalesce(array_agg(x.id), '{}') INTO v_ids FROM (
    SELECT d.id FROM public.email_deliveries d
      JOIN public.email_campaigns c ON c.id = d.campaign_id AND c.status = 'PROCESSING'
     WHERE (d.status IN ('PENDING', 'FAILED_RETRYABLE') AND coalesce(d.next_attempt_at, now()) <= now())
        OR (d.status = 'SENDING' AND d.lease_expires_at < now())
     ORDER BY coalesce(d.next_attempt_at, d.created_at), d.id
     LIMIT least(greatest(p_limit, 1), 200)
       FOR UPDATE OF d SKIP LOCKED
  ) x;

  -- A lease that expired after the last allowed attempt: outcome unknown, never auto-resent.
  UPDATE public.email_deliveries d
     SET status = 'UNKNOWN', lease_expires_at = NULL, last_error_code = 'LEASE_EXPIRED',
         last_error_summary = 'The send result was never recorded.'
   WHERE d.id = ANY (v_ids) AND d.status = 'SENDING' AND d.attempt_count >= 3;

  UPDATE public.email_deliveries d
     SET status = 'SKIPPED', next_attempt_at = NULL, lease_expires_at = NULL,
         last_error_code = 'NOT_ELIGIBLE', last_error_summary = 'Recipient is no longer eligible.'
   WHERE d.id = ANY (v_ids) AND d.status IN ('PENDING', 'FAILED_RETRYABLE', 'SENDING')
     AND NOT public.email_is_eligible(d.campaign_id, d.roster_member_id);

  RETURN QUERY
  WITH claimed AS (
    UPDATE public.email_deliveries d
       SET status = 'SENDING', attempt_count = d.attempt_count + 1, claimed_at = now(),
           last_attempt_at = now(), lease_expires_at = now() + make_interval(secs => p_lease_seconds)
     WHERE d.id = ANY (v_ids) AND d.status IN ('PENDING', 'FAILED_RETRYABLE', 'SENDING')
    RETURNING d.id, d.campaign_id, d.roster_member_id, d.recipient_email_snapshot, d.attempt_count
  )
  SELECT cl.id, cl.campaign_id, c.kind, c.template_key, c.template_version, c.subject_snapshot,
         cl.recipient_email_snapshot::text, rm.full_name::text, c.project_id, p.name::text,
         s.name::text, s.demo_registration_url, cl.attempt_count
    FROM claimed cl
    JOIN public.email_campaigns c ON c.id = cl.campaign_id
    JOIN public.roster_members rm ON rm.id = cl.roster_member_id
    JOIN public.semesters s ON s.id = c.semester_id
    LEFT JOIN public.projects p ON p.id = c.project_id;
END;
$$;

-- p_outcome: SENT | RETRYABLE | PERMANENT | UNKNOWN. Only a SENDING row can be settled,
-- so a late result for a reclaimed row cannot overwrite newer state. Returns the new status.
CREATE OR REPLACE FUNCTION public.email_record_delivery_result(
  p_delivery_id uuid, p_outcome text, p_message_id text, p_error_code text, p_error_summary text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_delivery public.email_deliveries; v_status text;
BEGIN
  SELECT * INTO v_delivery FROM public.email_deliveries WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND OR v_delivery.status <> 'SENDING' THEN RETURN NULL; END IF;

  v_status := CASE p_outcome
    WHEN 'SENT' THEN 'SENT'
    WHEN 'RETRYABLE' THEN CASE WHEN v_delivery.attempt_count >= 3
                               THEN 'FAILED_PERMANENT' ELSE 'FAILED_RETRYABLE' END
    WHEN 'PERMANENT' THEN 'FAILED_PERMANENT'
    WHEN 'UNKNOWN' THEN 'UNKNOWN'
    ELSE NULL END;
  IF v_status IS NULL THEN RAISE EXCEPTION 'INVALID_OUTCOME' USING ERRCODE = '22023'; END IF;

  UPDATE public.email_deliveries SET
    status = v_status,
    lease_expires_at = NULL,
    sent_at = CASE WHEN v_status = 'SENT' THEN now() ELSE sent_at END,
    provider_message_id = coalesce(p_message_id, provider_message_id),
    next_attempt_at = CASE WHEN v_status = 'FAILED_RETRYABLE'
                           THEN now() + make_interval(mins => power(2, v_delivery.attempt_count)::integer)
                           ELSE NULL END,
    last_error_code = CASE WHEN v_status = 'SENT' THEN NULL ELSE left(p_error_code, 100) END,
    last_error_summary = CASE WHEN v_status = 'SENT' THEN NULL ELSE left(p_error_summary, 300) END
  WHERE id = p_delivery_id;
  RETURN v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.email_finalize_due_campaigns()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_status text; v_done integer := 0;
BEGIN
  FOR v_id IN SELECT c.id FROM public.email_campaigns c WHERE c.status = 'PROCESSING' LOOP
    v_status := public.email_finalize_campaign(v_id);
    IF v_status IN ('COMPLETED', 'COMPLETED_WITH_FAILURES') THEN v_done := v_done + 1; END IF;
  END LOOP;
  RETURN v_done;
END;
$$;

-- =============================================================================
-- 5. Privileges: backend (service_role) only
-- =============================================================================
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.email_eligible_roster(uuid)',
    'public.email_is_eligible(uuid, uuid)',
    'public.email_materialize_campaign(uuid)',
    'public.email_finalize_campaign(uuid)',
    'public.admin_schedule_kickoff(uuid, uuid, timestamptz, text)',
    'public.admin_schedule_demo(uuid, uuid, timestamptz, text)',
    'public.admin_reschedule_campaign(uuid, uuid, timestamptz, text)',
    'public.admin_cancel_campaign(uuid, uuid, text)',
    'public.admin_retry_failed_deliveries(uuid, uuid, text)',
    'public.admin_resolve_unknown_delivery(uuid, uuid, uuid, text, text)',
    'public.admin_resend_campaign(uuid, uuid, text)',
    'public.admin_list_campaigns(uuid, uuid, text, text, integer, integer)',
    'public.admin_list_deliveries(uuid, text, text, integer, integer)',
    'public.email_claim_due_campaigns(integer)',
    'public.email_claim_due_deliveries(integer, integer)',
    'public.email_record_delivery_result(uuid, text, text, text, text)',
    'public.email_finalize_due_campaigns()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
