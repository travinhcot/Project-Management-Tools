-- Follow-up email after the kick-start: PROJECT_RESOURCES (per project). Apply after
-- emails-send-now.schema.sql. Recipients are the project's members (see email_eligible_roster);
-- the email links to the project page, which holds the repo, video guide and other resources.
BEGIN;

-- ---------- Allow the new kind ----------
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'public.email_campaigns'::regclass AND contype = 'c'
              AND pg_get_constraintdef(oid) LIKE '%KICKOFF%'
  LOOP
    EXECUTE format('ALTER TABLE public.email_campaigns DROP CONSTRAINT %I', c.conname);
  END LOOP;
END;
$$;
ALTER TABLE public.email_campaigns
  ADD CONSTRAINT email_campaigns_kind_check
    CHECK (kind IN ('KICKOFF', 'DEMO', 'PROJECT_RESOURCES')),
  ADD CONSTRAINT email_campaigns_kind_project_check
    CHECK ((kind IN ('KICKOFF', 'PROJECT_RESOURCES') AND project_id IS NOT NULL)
        OR (kind = 'DEMO' AND project_id IS NULL));

CREATE UNIQUE INDEX IF NOT EXISTS email_campaigns_one_active_project_resources
  ON public.email_campaigns (project_id)
  WHERE kind = 'PROJECT_RESOURCES' AND status IN ('DRAFT', 'SCHEDULED', 'PROCESSING');

-- ---------- Schedule ----------
CREATE FUNCTION public.admin_schedule_project_resources(
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
              WHERE c.project_id = p_project_id AND c.kind = 'PROJECT_RESOURCES'
                AND c.status IN ('DRAFT', 'SCHEDULED', 'PROCESSING')) THEN
    RAISE EXCEPTION 'CAMPAIGN_EXISTS' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.email_campaigns
    (id, semester_id, project_id, kind, scheduled_at, template_key, template_version, status,
     idempotency_key, created_by_user_id, subject_snapshot)
  VALUES (v_id, v_project.semester_id, p_project_id, 'PROJECT_RESOURCES', v_at, 'project-resources', 1,
          'SCHEDULED', 'project-resources:' || v_id::text, p_actor_id,
          'Project resources: ' || v_project.name)
  RETURNING * INTO v_row;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'EMAIL_CAMPAIGN_SCHEDULED', 'EMAIL_CAMPAIGN', v_row.id,
          jsonb_build_object('semester_id', v_row.semester_id, 'project_id', p_project_id,
                             'kind', 'PROJECT_RESOURCES', 'scheduled_at', v_row.scheduled_at,
                             'send_now', coalesce(p_send_now, false)),
          p_request_id);
  RETURN v_row;
END;
$$;

-- ---------- Resend: only DEMO needs the semester URL ----------
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

  IF v_source.kind IN ('KICKOFF', 'PROJECT_RESOURCES') THEN
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

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.admin_schedule_project_resources(uuid, uuid, timestamptz, boolean, text)',
    'public.admin_resend_campaign(uuid, uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
