-- "Send immediately" for kick-off and demo campaigns. Apply after emails.schema.sql.
-- Send now = scheduled_at is set to now(); the processor picks the campaign up on its next run
-- (email_claim_due_campaigns takes scheduled_at <= now()). The "must be in the future" rule
-- still applies to every explicit scheduled_at.
BEGIN;

-- ---------- Kick-off: p_scheduled_at ignored when p_send_now ----------
DROP FUNCTION public.admin_schedule_kickoff(uuid, uuid, timestamptz, text);
CREATE FUNCTION public.admin_schedule_kickoff(
  p_actor_id uuid, p_project_id uuid, p_scheduled_at timestamptz, p_send_now boolean, p_request_id text
) RETURNS public.email_campaigns
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_project public.projects; v_row public.email_campaigns; v_id uuid := gen_random_uuid();
  v_at timestamptz;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_project.archived_at IS NOT NULL THEN RAISE EXCEPTION 'PROJECT_ARCHIVED' USING ERRCODE = 'P0001'; END IF;
  IF coalesce(p_send_now, false) THEN
    v_at := now();
  ELSE
    IF p_scheduled_at IS NULL OR p_scheduled_at <= now() THEN
      RAISE EXCEPTION 'SCHEDULE_IN_PAST' USING ERRCODE = '22023';
    END IF;
    v_at := p_scheduled_at;
  END IF;
  IF EXISTS (SELECT 1 FROM public.email_campaigns c
              WHERE c.project_id = p_project_id AND c.kind = 'KICKOFF'
                AND c.status IN ('DRAFT', 'SCHEDULED', 'PROCESSING')) THEN
    RAISE EXCEPTION 'CAMPAIGN_EXISTS' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.email_campaigns
    (id, semester_id, project_id, kind, scheduled_at, template_key, template_version, status,
     idempotency_key, created_by_user_id, subject_snapshot)
  VALUES (v_id, v_project.semester_id, p_project_id, 'KICKOFF', v_at, 'project-kickoff', 1,
          'SCHEDULED', 'kickoff:' || v_id::text, p_actor_id,
          'Project kick-off: ' || v_project.name)
  RETURNING * INTO v_row;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'EMAIL_CAMPAIGN_SCHEDULED', 'EMAIL_CAMPAIGN', v_row.id,
          jsonb_build_object('semester_id', v_row.semester_id, 'project_id', p_project_id,
                             'kind', 'KICKOFF', 'scheduled_at', v_row.scheduled_at,
                             'send_now', coalesce(p_send_now, false)),
          p_request_id);
  RETURN v_row;
END;
$$;

-- ---------- Demo ----------
DROP FUNCTION public.admin_schedule_demo(uuid, uuid, timestamptz, text);
CREATE FUNCTION public.admin_schedule_demo(
  p_actor_id uuid, p_semester_id uuid, p_scheduled_at timestamptz, p_send_now boolean, p_request_id text
) RETURNS public.email_campaigns
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_semester public.semesters; v_row public.email_campaigns; v_id uuid := gen_random_uuid();
  v_at timestamptz;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  SELECT * INTO v_semester FROM public.semesters WHERE id = p_semester_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SEMESTER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_semester.demo_registration_url IS NULL THEN
    RAISE EXCEPTION 'DEMO_URL_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(p_send_now, false) THEN
    v_at := now();
  ELSE
    IF p_scheduled_at IS NULL OR p_scheduled_at <= now() THEN
      RAISE EXCEPTION 'SCHEDULE_IN_PAST' USING ERRCODE = '22023';
    END IF;
    v_at := p_scheduled_at;
  END IF;
  IF EXISTS (SELECT 1 FROM public.email_campaigns c
              WHERE c.semester_id = p_semester_id AND c.kind = 'DEMO'
                AND c.status IN ('DRAFT', 'SCHEDULED', 'PROCESSING')) THEN
    RAISE EXCEPTION 'CAMPAIGN_EXISTS' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.email_campaigns
    (id, semester_id, project_id, kind, scheduled_at, template_key, template_version, status,
     idempotency_key, created_by_user_id, subject_snapshot)
  VALUES (v_id, p_semester_id, NULL, 'DEMO', v_at, 'semester-demo', 1,
          'SCHEDULED', 'demo:' || v_id::text, p_actor_id,
          'Demo registration: ' || v_semester.name)
  RETURNING * INTO v_row;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'EMAIL_CAMPAIGN_SCHEDULED', 'EMAIL_CAMPAIGN', v_row.id,
          jsonb_build_object('semester_id', v_row.semester_id, 'kind', 'DEMO',
                             'scheduled_at', v_row.scheduled_at,
                             'send_now', coalesce(p_send_now, false)),
          p_request_id);
  RETURN v_row;
END;
$$;

-- ---------- Send an already scheduled campaign now ----------
CREATE FUNCTION public.admin_send_campaign_now(
  p_actor_id uuid, p_campaign_id uuid, p_request_id text
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

  UPDATE public.email_campaigns SET scheduled_at = now()
   WHERE id = p_campaign_id RETURNING * INTO v_row;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'EMAIL_CAMPAIGN_RESCHEDULED', 'EMAIL_CAMPAIGN', v_row.id,
          jsonb_build_object('semester_id', v_row.semester_id, 'kind', v_row.kind,
                             'before', v_before.scheduled_at, 'after', v_row.scheduled_at,
                             'send_now', true),
          p_request_id);
  RETURN v_row;
END;
$$;

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.admin_schedule_kickoff(uuid, uuid, timestamptz, boolean, text)',
    'public.admin_schedule_demo(uuid, uuid, timestamptz, boolean, text)',
    'public.admin_send_campaign_now(uuid, uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
