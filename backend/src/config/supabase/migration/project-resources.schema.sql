-- Required resources per project (Package 4). Apply after research-project-type, files, dashboard.
-- ALTER-based: safe on a DB with data.
--   * new slots: RESEARCH_TEMPLATE (file, RESEARCH projects only), GITHUB_REPO and DEMO_GUIDE (links)
--   * one SQL definition of "which slots a project type can hold / must fill" (twin of
--     backend/src/shared/resource-rules.ts); triggers, functions and the dashboard use it
--   * SRS and the research template are uploaded files (old SRS links stay readable)
--   * the old CONTRIBUTION_TEMPLATE slot (not defined anywhere else in this repo) is removed:
--     its rows are deleted in section 0. Storage objects are NOT touched; delete them by hand.
BEGIN;

-- =============================================================================
-- 0. Remove the retired CONTRIBUTION_TEMPLATE slot (resources first: they reference the files)
-- =============================================================================
DELETE FROM public.project_resources WHERE slot = 'CONTRIBUTION_TEMPLATE';
DELETE FROM public.project_files WHERE slot = 'CONTRIBUTION_TEMPLATE';

-- =============================================================================
-- 1. The rule
-- =============================================================================
CREATE OR REPLACE FUNCTION public.resource_slot_allowed(p_type text, p_slot text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_slot
    WHEN 'SRS' THEN true
    WHEN 'FIRST_MEETING' THEN true
    WHEN 'GITHUB_REPO' THEN true
    WHEN 'DEMO_GUIDE' THEN true
    WHEN 'BOM' THEN p_type = 'HARDWARE'
    WHEN 'RESEARCH_TEMPLATE' THEN p_type = 'RESEARCH'
    ELSE false
  END;
$$;

-- GITHUB_REPO and DEMO_GUIDE are set after the kick-start date: never counted as missing.
CREATE OR REPLACE FUNCTION public.project_required_slots(p_type text)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_type
    WHEN 'HARDWARE' THEN ARRAY['SRS', 'FIRST_MEETING', 'BOM']
    WHEN 'RESEARCH' THEN ARRAY['SRS', 'FIRST_MEETING', 'RESEARCH_TEMPLATE']
    ELSE ARRAY['SRS', 'FIRST_MEETING']
  END;
$$;

-- =============================================================================
-- 2. Slot constraints
-- =============================================================================
ALTER TABLE public.project_files
  DROP CONSTRAINT IF EXISTS project_files_slot_check,
  ADD CONSTRAINT project_files_slot_check CHECK (slot IN ('SRS', 'BOM', 'RESEARCH_TEMPLATE'));

ALTER TABLE public.project_resources
  DROP CONSTRAINT IF EXISTS project_resources_slot_check,
  DROP CONSTRAINT IF EXISTS project_resources_first_meeting_link,
  ADD CONSTRAINT project_resources_slot_check CHECK (slot IN
    ('SRS', 'FIRST_MEETING', 'BOM', 'RESEARCH_TEMPLATE', 'GITHUB_REPO', 'DEMO_GUIDE')),
  ADD CONSTRAINT project_resources_link_only_slots CHECK (
    slot NOT IN ('FIRST_MEETING', 'GITHUB_REPO', 'DEMO_GUIDE') OR source_type = 'LINK'),
  ADD CONSTRAINT project_resources_file_only_template CHECK (
    slot <> 'RESEARCH_TEMPLATE' OR source_type = 'FILE');

-- =============================================================================
-- 3. Triggers
-- =============================================================================
CREATE OR REPLACE FUNCTION public.validate_project_file_slot()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_type text;
BEGIN
  SELECT type INTO v_type FROM public.projects WHERE id = NEW.project_id FOR UPDATE;
  IF NOT public.resource_slot_allowed(v_type, NEW.slot) THEN
    RAISE EXCEPTION 'RESOURCE_SLOT_NOT_ALLOWED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_project_resource()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_type text; v_file public.project_files;
BEGIN
  SELECT type INTO v_type FROM public.projects WHERE id = NEW.project_id FOR UPDATE;
  IF NOT public.resource_slot_allowed(v_type, NEW.slot) THEN
    RAISE EXCEPTION 'RESOURCE_SLOT_NOT_ALLOWED' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.file_id IS NOT NULL THEN
    SELECT * INTO v_file FROM public.project_files WHERE id = NEW.file_id;
    IF v_file.project_id <> NEW.project_id OR v_file.slot <> NEW.slot OR v_file.status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'RESOURCE_FILE_MISMATCH' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- A project keeps its type while it holds a resource only that type can have (BOM, research template).
CREATE OR REPLACE FUNCTION public.validate_project_slots()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_slot text;
BEGIN
  IF OLD.type IS DISTINCT FROM NEW.type THEN
    SELECT s.slot INTO v_slot
      FROM (SELECT slot FROM public.project_resources WHERE project_id = NEW.id
            UNION
            SELECT slot FROM public.project_files
             WHERE project_id = NEW.id AND status IN ('UPLOADING', 'ACTIVE')) s
     WHERE NOT public.resource_slot_allowed(NEW.type, s.slot)
     ORDER BY s.slot LIMIT 1;
    IF v_slot = 'BOM' THEN
      RAISE EXCEPTION 'PROJECT_HAS_BOM' USING ERRCODE = 'P0001';
    ELSIF v_slot = 'RESEARCH_TEMPLATE' THEN
      RAISE EXCEPTION 'PROJECT_HAS_RESEARCH_TEMPLATE' USING ERRCODE = 'P0001';
    ELSIF v_slot IS NOT NULL THEN
      RAISE EXCEPTION 'RESOURCE_SLOT_NOT_ALLOWED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 4. Admin functions
-- =============================================================================
-- Links: FIRST_MEETING, GITHUB_REPO, DEMO_GUIDE, BOM. SRS and the research template are files only.
CREATE OR REPLACE FUNCTION public.admin_set_project_resource_link(
  p_actor_id uuid, p_project_id uuid, p_slot text, p_url text, p_label text, p_request_id text
) RETURNS public.project_resources
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_type text; v_row public.project_resources; v_retired uuid;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  v_type := public.files_lock_project(p_project_id);
  IF p_slot NOT IN ('SRS', 'FIRST_MEETING', 'BOM', 'RESEARCH_TEMPLATE', 'GITHUB_REPO', 'DEMO_GUIDE') THEN
    RAISE EXCEPTION 'INVALID_SLOT' USING ERRCODE = '22023';
  END IF;
  IF p_slot IN ('SRS', 'RESEARCH_TEMPLATE') THEN
    RAISE EXCEPTION 'RESOURCE_SOURCE_NOT_ALLOWED' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.resource_slot_allowed(v_type, p_slot) THEN
    RAISE EXCEPTION 'RESOURCE_SLOT_NOT_ALLOWED' USING ERRCODE = 'P0001';
  END IF;
  IF p_url IS NULL OR p_url !~ '^https://' THEN RAISE EXCEPTION 'INVALID_URL' USING ERRCODE = '22023'; END IF;

  -- Switching FILE -> LINK retires the file (the retired object is kept).
  UPDATE public.project_files SET status = 'RETIRED', retired_at = now()
   WHERE project_id = p_project_id AND slot = p_slot AND status = 'ACTIVE'
  RETURNING id INTO v_retired;
  DELETE FROM public.project_resources WHERE project_id = p_project_id AND slot = p_slot;

  INSERT INTO public.project_resources (project_id, slot, source_type, url, label, updated_by_user_id)
  VALUES (p_project_id, p_slot, 'LINK', p_url, nullif(btrim(p_label), ''), p_actor_id)
  RETURNING * INTO v_row;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'RESOURCE_UPDATED', 'PROJECT', p_project_id,
          jsonb_strip_nulls(jsonb_build_object('slot', p_slot, 'source_type', 'LINK',
            'retired_file_id', v_retired)), p_request_id);
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_begin_file_upload(
  p_actor_id uuid, p_project_id uuid, p_slot text, p_bucket_id text, p_object_path text,
  p_original_filename text, p_content_type text, p_size_bytes bigint, p_checksum_sha256 text
) RETURNS public.project_files
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_type text; v_row public.project_files;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  v_type := public.files_lock_project(p_project_id);
  IF p_slot NOT IN ('SRS', 'BOM', 'RESEARCH_TEMPLATE') THEN
    RAISE EXCEPTION 'RESOURCE_SOURCE_NOT_ALLOWED' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.resource_slot_allowed(v_type, p_slot) THEN
    RAISE EXCEPTION 'RESOURCE_SLOT_NOT_ALLOWED' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.project_files (project_id, slot, bucket_id, object_path, original_filename,
                                    content_type, size_bytes, checksum_sha256, status, uploaded_by_user_id)
  VALUES (p_project_id, p_slot, p_bucket_id, p_object_path, p_original_filename,
          p_content_type, p_size_bytes, p_checksum_sha256, 'UPLOADING', p_actor_id)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- =============================================================================
-- 5. Dashboard: required slots come from project_required_slots; SRS has its own warning
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_dashboard_summary(p_actor_id uuid, p_item_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_sem public.semesters;
  v_result jsonb;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  SELECT * INTO v_sem FROM public.semesters WHERE is_current;

  -- Campaigns still scheduled for a semester that is no longer current (FR-SEM-02 flag).
  v_result := jsonb_build_object(
    'semester', CASE WHEN v_sem.id IS NULL THEN NULL
                     ELSE jsonb_build_object('id', v_sem.id, 'name', v_sem.name) END,
    'old_semester_scheduled', (
      SELECT jsonb_build_object(
        'count', count(*),
        'items', coalesce(jsonb_agg(jsonb_build_object(
          'id', c.id, 'name', coalesce(p.name::text, 'Demo'), 'kind', c.kind,
          'scheduled_at', c.scheduled_at, 'semester_name', s.name) ORDER BY c.scheduled_at)
          FILTER (WHERE c.rn <= p_item_limit), '[]'::jsonb))
        FROM (SELECT c.*, row_number() OVER (ORDER BY c.scheduled_at) AS rn
                FROM public.email_campaigns c
               WHERE c.status = 'SCHEDULED'
                 AND (v_sem.id IS NULL OR c.semester_id <> v_sem.id)) c
        JOIN public.semesters s ON s.id = c.semester_id
        LEFT JOIN public.projects p ON p.id = c.project_id)
  );
  IF v_sem.id IS NULL THEN RETURN v_result; END IF;

  RETURN v_result || jsonb_build_object(
    'roster_active', (SELECT count(*) FROM public.roster_members
                       WHERE semester_id = v_sem.id AND status = 'ACTIVE'),
    'projects', jsonb_build_object(
      'software', (SELECT count(*) FROM public.projects
                    WHERE semester_id = v_sem.id AND archived_at IS NULL AND type = 'SOFTWARE'),
      'hardware', (SELECT count(*) FROM public.projects
                    WHERE semester_id = v_sem.id AND archived_at IS NULL AND type = 'HARDWARE'),
      'research', (SELECT count(*) FROM public.projects
                    WHERE semester_id = v_sem.id AND archived_at IS NULL AND type = 'RESEARCH')),
    'upcoming_campaigns', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id', u.id, 'kind', u.kind, 'project_id', u.project_id,
               'name', coalesce(u.project_name, 'Demo'), 'scheduled_at', u.scheduled_at,
               'overdue', u.scheduled_at <= now()) ORDER BY u.scheduled_at), '[]'::jsonb)
        FROM (SELECT c.id, c.kind, c.project_id, p.name::text AS project_name, c.scheduled_at
                FROM public.email_campaigns c
                LEFT JOIN public.projects p ON p.id = c.project_id
               WHERE c.semester_id = v_sem.id AND c.status = 'SCHEDULED'
               ORDER BY c.scheduled_at LIMIT p_item_limit) u),
    'deliveries', (
      SELECT jsonb_build_object(
               'failed', count(*) FILTER (WHERE d.status IN ('FAILED_RETRYABLE', 'FAILED_PERMANENT')),
               'unknown', count(*) FILTER (WHERE d.status = 'UNKNOWN'))
        FROM public.email_deliveries d WHERE d.semester_id = v_sem.id),
    'projects_without_members', (
      SELECT jsonb_build_object('count', count(*),
               'items', coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name)
                                           ORDER BY x.name) FILTER (WHERE x.rn <= p_item_limit), '[]'::jsonb))
        FROM (SELECT p.id, p.name::text AS name, row_number() OVER (ORDER BY p.name, p.id) AS rn
                FROM public.projects p
               WHERE p.semester_id = v_sem.id AND p.archived_at IS NULL
                 AND NOT EXISTS (SELECT 1 FROM public.project_members pm
                                  WHERE pm.project_id = p.id AND pm.removed_at IS NULL)) x),
    -- SRS has its own warning ("SRS missing"); the general one lists every other required slot.
    'projects_missing_srs', (
      SELECT jsonb_build_object('count', count(*),
               'items', coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name)
                                           ORDER BY x.name) FILTER (WHERE x.rn <= p_item_limit), '[]'::jsonb))
        FROM (SELECT p.id, p.name::text AS name, row_number() OVER (ORDER BY p.name, p.id) AS rn
                FROM public.projects p
               WHERE p.semester_id = v_sem.id AND p.archived_at IS NULL
                 AND 'SRS' = ANY (public.project_required_slots(p.type))
                 AND NOT EXISTS (SELECT 1 FROM public.project_resources r
                                  WHERE r.project_id = p.id AND r.slot = 'SRS')) x),
    'projects_missing_resources', (
      SELECT jsonb_build_object('count', count(*),
               'items', coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'missing', x.missing)
                                           ORDER BY x.name) FILTER (WHERE x.rn <= p_item_limit), '[]'::jsonb))
        FROM (SELECT m.id, m.name, m.missing, row_number() OVER (ORDER BY m.name, m.id) AS rn
                FROM (SELECT p.id, p.name::text AS name,
                             ARRAY(SELECT s FROM unnest(public.project_required_slots(p.type)) s
                                    WHERE s <> 'SRS'
                                      AND NOT EXISTS (SELECT 1 FROM public.project_resources r
                                                       WHERE r.project_id = p.id AND r.slot = s)) AS missing
                        FROM public.projects p
                       WHERE p.semester_id = v_sem.id AND p.archived_at IS NULL) m
               WHERE cardinality(m.missing) > 0) x),
    'campaigns_with_failures', (
      SELECT jsonb_build_object('count', count(*),
               'items', coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'kind', x.kind)
                                           ORDER BY x.completed_at DESC) FILTER (WHERE x.rn <= p_item_limit), '[]'::jsonb))
        FROM (SELECT c.id, coalesce(p.name::text, 'Demo') AS name, c.kind, c.completed_at,
                     row_number() OVER (ORDER BY c.completed_at DESC NULLS LAST, c.id) AS rn
                FROM public.email_campaigns c
                LEFT JOIN public.projects p ON p.id = c.project_id
               WHERE c.semester_id = v_sem.id AND c.status = 'COMPLETED_WITH_FAILURES') x),
    'imports_expired_unused', (
      SELECT jsonb_build_object('count', count(*),
               'items', coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.filename, 'created_at', x.created_at)
                                           ORDER BY x.created_at DESC) FILTER (WHERE x.rn <= p_item_limit), '[]'::jsonb))
        FROM (SELECT i.id, i.filename, i.created_at,
                     row_number() OVER (ORDER BY i.created_at DESC, i.id) AS rn
                FROM public.roster_imports i
               WHERE i.semester_id = v_sem.id
                 AND (i.status = 'EXPIRED' OR (i.status = 'PREVIEWED' AND i.expires_at <= now()))) x)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resource_slot_allowed(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.project_required_slots(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resource_slot_allowed(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.project_required_slots(text) TO service_role;

COMMIT;
