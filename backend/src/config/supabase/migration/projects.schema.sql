-- Projects (FR-PRJ-01..03). Apply after app-user, platform-tables, user-management,
-- semesters-roster. ALTER-based: safe on a DB that already has seed data.
BEGIN;

-- =============================================================================
-- 0. Pre-check: names must be unique per semester (case-insensitive, trimmed).
--    No auto-rename: abort with the list.
-- =============================================================================
DO $$
DECLARE dup text;
BEGIN
  SELECT string_agg(format('%L in semester %s (%s rows)', d.sample, d.semester_id, d.n), '; ')
    INTO dup
    FROM (SELECT semester_id, min(btrim(name)) AS sample, count(*) AS n
            FROM public.projects
           GROUP BY semester_id, lower(btrim(name))
          HAVING count(*) > 1) d;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION 'Rename duplicate project names before migrating: %', dup;
  END IF;
END;
$$;

-- =============================================================================
-- 1. projects (owned by: projects)
-- =============================================================================
UPDATE public.projects SET name = btrim(name) WHERE name <> btrim(name);

ALTER TABLE public.projects
  DROP COLUMN kickoff_scheduled_at,                                  -- I-04: emails owns schedules
  ADD COLUMN description text
    CONSTRAINT projects_description_length CHECK (description IS NULL OR char_length(description) <= 2000),
  ADD COLUMN created_by_user_id uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,  -- NULL for old rows
  ADD CONSTRAINT projects_name_trimmed CHECK (name = btrim(name));
CREATE UNIQUE INDEX projects_semester_name_unique ON public.projects (semester_id, lower(name));  -- I-06

-- HARDWARE -> SOFTWARE only when no BOM is present now (URL or active file).
-- Reads project_files (owned by files) as a cross-table invariant.
CREATE OR REPLACE FUNCTION public.validate_project_slots()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.type = 'HARDWARE' AND NEW.type <> 'HARDWARE' AND (
       NEW.bom_external_url IS NOT NULL
       OR EXISTS (SELECT 1 FROM public.project_files
                   WHERE project_id = NEW.id AND category = 'BOM' AND retired_at IS NULL)) THEN
    RAISE EXCEPTION 'PROJECT_HAS_BOM' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.project_files WHERE project_id = NEW.id AND retired_at IS NULL
      AND ((category = 'SRS' AND NEW.srs_external_url IS NOT NULL)
        OR (category = 'BOM' AND NEW.bom_external_url IS NOT NULL))
  ) THEN RAISE EXCEPTION 'A project slot cannot contain both a URL and an active file'; END IF;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 2. project_members (owned by: projects) - minimal prep so counts and the
--    archive rule work. Assign/remove endpoints come with the assignments plan.
-- =============================================================================
ALTER TABLE public.project_members
  DROP CONSTRAINT project_members_project_id_roster_member_id_key,
  ADD COLUMN removed_at timestamptz,
  ADD COLUMN removed_by_user_id uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT project_members_removal_consistent
    CHECK ((removed_at IS NULL) = (removed_by_user_id IS NULL));
CREATE UNIQUE INDEX project_members_one_active
  ON public.project_members (project_id, roster_member_id) WHERE removed_at IS NULL;
CREATE INDEX project_members_active_by_project
  ON public.project_members (project_id) WHERE removed_at IS NULL;

-- FR-PRJ-03: an archived project cannot get new (or restored) assignments.
-- FOR SHARE on the project row serialises with archive (which takes FOR UPDATE).
CREATE FUNCTION public.project_members_guard_archived()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_archived timestamptz;
BEGIN
  IF TG_OP = 'INSERT' OR (OLD.removed_at IS NOT NULL AND NEW.removed_at IS NULL) THEN
    SELECT archived_at INTO v_archived FROM public.projects WHERE id = NEW.project_id FOR SHARE;
    IF FOUND AND v_archived IS NOT NULL THEN
      RAISE EXCEPTION 'PROJECT_ARCHIVED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER project_members_guard_archived BEFORE INSERT OR UPDATE ON public.project_members
FOR EACH ROW EXECUTE FUNCTION public.project_members_guard_archived();

-- =============================================================================
-- 3. Functions
-- =============================================================================
-- Lock the FK parent so it cannot vanish mid-write. Reads semesters, never writes it.
CREATE FUNCTION public.project_lock_semester(p_semester_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.semesters WHERE id = p_semester_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SEMESTER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
END;
$$;

-- ---------- Create (FR-PRJ-01) ----------
CREATE FUNCTION public.admin_create_project(
  p_actor_id uuid, p_semester_id uuid, p_name text, p_type text, p_description text, p_request_id text
) RETURNS public.projects
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.projects;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  PERFORM public.project_lock_semester(p_semester_id);
  INSERT INTO public.projects (semester_id, name, type, description, created_by_user_id)
  VALUES (p_semester_id, btrim(p_name), p_type, nullif(btrim(p_description), ''), p_actor_id)
  RETURNING * INTO v_row;                                   -- same name in semester -> 23505

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'PROJECT_CREATED', 'PROJECT', v_row.id,
          jsonb_build_object('semester_id', v_row.semester_id, 'name', v_row.name, 'type', v_row.type),
          p_request_id);
  RETURN v_row;
END;
$$;

-- ---------- Update (FR-PRJ-01 Medium) ----------
-- p_changes: any subset of {name, description, type, semester_id}.
-- p_expected_updated_at: the updated_at the client loaded (optimistic concurrency).
CREATE FUNCTION public.admin_update_project(
  p_actor_id uuid, p_project_id uuid, p_expected_updated_at timestamptz,
  p_changes jsonb, p_request_id text
) RETURNS public.projects
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_before public.projects;
  v_after  public.projects;
  v_target uuid;
  v_fields text[];
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_changes) k
                 WHERE k NOT IN ('name', 'description', 'type', 'semester_id')) THEN
    RAISE EXCEPTION 'NO_CHANGES' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_before.archived_at IS NOT NULL THEN RAISE EXCEPTION 'PROJECT_ARCHIVED' USING ERRCODE = 'P0001'; END IF;
  IF v_before.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'PROJECT_STALE' USING ERRCODE = 'P0001';
  END IF;

  v_target := coalesce((p_changes->>'semester_id')::uuid, v_before.semester_id);
  IF v_target <> v_before.semester_id THEN
    PERFORM public.project_lock_semester(v_target);
    -- The composite FKs (project_id, semester_id) would block this anyway; say why clearly.
    IF EXISTS (SELECT 1 FROM public.project_members WHERE project_id = p_project_id) THEN
      RAISE EXCEPTION 'PROJECT_HAS_ASSIGNMENTS' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.projects SET
    name        = CASE WHEN p_changes ? 'name' THEN btrim(p_changes->>'name') ELSE name END,
    description = CASE WHEN p_changes ? 'description' THEN nullif(btrim(p_changes->>'description'), '') ELSE description END,
    type        = CASE WHEN p_changes ? 'type' THEN p_changes->>'type' ELSE type END,
    semester_id = v_target
  WHERE id = p_project_id
  RETURNING * INTO v_after;            -- 23505 duplicate name; 23503 email_campaigns FK; PROJECT_HAS_BOM

  SELECT array_agg(t.f ORDER BY t.f) INTO v_fields FROM (VALUES
    ('name',        v_before.name        IS DISTINCT FROM v_after.name),
    ('description', v_before.description IS DISTINCT FROM v_after.description),
    ('type',        v_before.type        IS DISTINCT FROM v_after.type),
    ('semester_id', v_before.semester_id IS DISTINCT FROM v_after.semester_id)) AS t(f, changed)
  WHERE t.changed;

  IF v_fields IS NOT NULL THEN
    INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
    VALUES (p_actor_id, 'PROJECT_UPDATED', 'PROJECT', v_after.id,
            jsonb_build_object(
              'semester_id', v_after.semester_id,
              'fields', to_jsonb(v_fields),
              -- description text is not copied into audit; only that it changed
              'before', jsonb_strip_nulls(jsonb_build_object(
                 'name', CASE WHEN 'name' = ANY(v_fields) THEN v_before.name END,
                 'type', CASE WHEN 'type' = ANY(v_fields) THEN v_before.type END,
                 'semester_id', CASE WHEN 'semester_id' = ANY(v_fields) THEN v_before.semester_id END)),
              'after', jsonb_strip_nulls(jsonb_build_object(
                 'name', CASE WHEN 'name' = ANY(v_fields) THEN v_after.name END,
                 'type', CASE WHEN 'type' = ANY(v_fields) THEN v_after.type END,
                 'semester_id', CASE WHEN 'semester_id' = ANY(v_fields) THEN v_after.semester_id END))),
            p_request_id);
  END IF;
  RETURN v_after;
END;
$$;

-- ---------- Archive / unarchive (FR-PRJ-03) ----------
-- p_cancelled_campaign_id: set by the service when it cancelled a kick-off first (audit only).
CREATE FUNCTION public.admin_archive_project(
  p_actor_id uuid, p_project_id uuid, p_cancelled_campaign_id uuid, p_request_id text
) RETURNS public.projects
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.projects; v_members bigint;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  SELECT * INTO v_row FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_row.archived_at IS NOT NULL THEN RAISE EXCEPTION 'PROJECT_ALREADY_ARCHIVED' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.projects SET archived_at = now() WHERE id = p_project_id RETURNING * INTO v_row;
  SELECT count(*) INTO v_members FROM public.project_members
   WHERE project_id = p_project_id AND removed_at IS NULL;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'PROJECT_ARCHIVED', 'PROJECT', v_row.id,
          jsonb_strip_nulls(jsonb_build_object('semester_id', v_row.semester_id, 'name', v_row.name,
            'active_members', v_members, 'cancelled_kickoff_campaign_id', p_cancelled_campaign_id)),
          p_request_id);
  RETURN v_row;
END;
$$;

CREATE FUNCTION public.admin_unarchive_project(
  p_actor_id uuid, p_project_id uuid, p_request_id text
) RETURNS public.projects
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.projects;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  SELECT * INTO v_row FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_row.archived_at IS NULL THEN RAISE EXCEPTION 'PROJECT_NOT_ARCHIVED' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.projects SET archived_at = NULL WHERE id = p_project_id RETURNING * INTO v_row;
  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'PROJECT_UNARCHIVED', 'PROJECT', v_row.id,
          jsonb_build_object('semester_id', v_row.semester_id, 'name', v_row.name), p_request_id);
  RETURN v_row;
END;
$$;

-- ---------- List (FR-PRJ-02) - one statement, member counts included (no N+1) ----------
-- p_archived: 'exclude' (default) | 'include' | 'only'
CREATE FUNCTION public.admin_list_projects(
  p_semester_id uuid, p_search text, p_type text, p_archived text, p_limit integer, p_offset integer
) RETURNS TABLE (
  id uuid, semester_id uuid, name varchar, description text, type text, archived_at timestamptz,
  created_by_user_id uuid, created_at timestamptz, updated_at timestamptz,
  member_count bigint, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.semester_id, p.name, p.description, p.type, p.archived_at,
         p.created_by_user_id, p.created_at, p.updated_at,
         (SELECT count(*) FROM public.project_members pm
           WHERE pm.project_id = p.id AND pm.removed_at IS NULL),
         count(*) OVER ()
    FROM public.projects p
   WHERE p.semester_id = p_semester_id
     AND (p_search IS NULL OR strpos(lower(p.name), lower(p_search)) > 0)
     AND (p_type IS NULL OR p.type = p_type)
     AND CASE coalesce(p_archived, 'exclude')
           WHEN 'exclude' THEN p.archived_at IS NULL
           WHEN 'only'    THEN p.archived_at IS NOT NULL
           ELSE true END
   ORDER BY lower(p.name), p.id
   LIMIT least(greatest(p_limit, 1), 100)
  OFFSET greatest(p_offset, 0);
END;
$$;

-- =============================================================================
-- 4. Privileges: backend (service_role) only
-- =============================================================================
REVOKE ALL ON FUNCTION public.project_lock_semester(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.project_members_guard_archived() FROM PUBLIC, anon, authenticated;
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.admin_create_project(uuid, uuid, text, text, text, text)',
    'public.admin_update_project(uuid, uuid, timestamptz, jsonb, text)',
    'public.admin_archive_project(uuid, uuid, uuid, text)',
    'public.admin_unarchive_project(uuid, uuid, text)',
    'public.admin_list_projects(uuid, text, text, text, integer, integer)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
