-- One shared kick-start meeting link per semester. A project's own FIRST_MEETING link still wins;
-- this link is the fallback when a project has none. Apply after semesters-roster.schema.sql.
BEGIN;

ALTER TABLE public.semesters
  ADD COLUMN kickoff_meeting_url text
    CONSTRAINT semesters_kickoff_meeting_url_check
    CHECK (kickoff_meeting_url IS NULL OR kickoff_meeting_url ~ '^https://[^[:space:]]+$');

-- Same function as before, with kickoff_meeting_url among the changeable fields.
CREATE OR REPLACE FUNCTION public.admin_update_semester(
  p_actor_id uuid, p_semester_id uuid, p_changes jsonb, p_request_id text
) RETURNS public.semesters
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_row public.semesters;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_changes) k
                 WHERE k NOT IN ('term', 'year', 'starts_on', 'ends_on', 'demo_registration_url',
                                 'kickoff_meeting_url')) THEN
    RAISE EXCEPTION 'NO_CHANGES' USING ERRCODE = '22023';
  END IF;

  UPDATE public.semesters SET
    term = CASE WHEN p_changes ? 'term' THEN p_changes->>'term' ELSE term END,
    year = CASE WHEN p_changes ? 'year' THEN (p_changes->>'year')::smallint ELSE year END,
    starts_on = CASE WHEN p_changes ? 'starts_on' THEN (p_changes->>'starts_on')::date ELSE starts_on END,
    ends_on = CASE WHEN p_changes ? 'ends_on' THEN (p_changes->>'ends_on')::date ELSE ends_on END,
    demo_registration_url = CASE WHEN p_changes ? 'demo_registration_url'
                                 THEN p_changes->>'demo_registration_url' ELSE demo_registration_url END,
    kickoff_meeting_url = CASE WHEN p_changes ? 'kickoff_meeting_url'
                               THEN p_changes->>'kickoff_meeting_url' ELSE kickoff_meeting_url END
  WHERE id = p_semester_id
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEMESTER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'SEMESTER_UPDATED', 'SEMESTER', v_row.id,
          jsonb_build_object('name', v_row.name,
            'fields', (SELECT jsonb_agg(k ORDER BY k) FROM jsonb_object_keys(p_changes) k)),
          p_request_id);
  RETURN v_row;
END;
$$;

-- The shared kick-start link of the semester a project belongs to (null when none is set).
CREATE FUNCTION public.project_semester_kickoff_url(p_project_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.kickoff_meeting_url
    FROM public.projects p
    JOIN public.semesters s ON s.id = p.semester_id
   WHERE p.id = p_project_id;
$$;

REVOKE ALL ON FUNCTION public.project_semester_kickoff_url(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.project_semester_kickoff_url(uuid) TO service_role;

COMMIT;
