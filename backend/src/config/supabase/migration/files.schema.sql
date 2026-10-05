-- Resources and files (FR-RES-01, FR-FILE-01, FR-FILE-02). Apply after app-user, platform-tables,
-- user-management, semesters-roster, projects, project-members. ALTER-based: safe on a DB with seed data.
-- Moves the slot URLs off projects into project_resources and gives project_files a lifecycle status.
BEGIN;

-- =============================================================================
-- 1. project_files (owned by: files)
-- =============================================================================
ALTER TABLE public.project_files RENAME COLUMN category TO slot;
ALTER TABLE public.project_files RENAME COLUMN checksum TO checksum_sha256;
ALTER TABLE public.project_files
  DROP CONSTRAINT project_files_category_check,
  ADD CONSTRAINT project_files_slot_check CHECK (slot IN ('SRS', 'BOM')),
  ADD COLUMN status text NOT NULL DEFAULT 'ACTIVE'
    CONSTRAINT project_files_status_check CHECK (status IN ('UPLOADING', 'ACTIVE', 'RETIRED')),
  ADD CONSTRAINT project_files_sha256_format CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$');
UPDATE public.project_files SET status = 'RETIRED' WHERE retired_at IS NOT NULL;
ALTER TABLE public.project_files
  ADD CONSTRAINT project_files_retired_consistent CHECK ((status = 'RETIRED') = (retired_at IS NOT NULL));

DROP INDEX public.project_files_one_current_slot;
CREATE UNIQUE INDEX project_files_one_active_slot
  ON public.project_files (project_id, slot) WHERE status = 'ACTIVE';
CREATE INDEX project_files_status_created ON public.project_files (status, created_at);

-- Lock the project row so concurrent writes to a project's slots serialize.
CREATE OR REPLACE FUNCTION public.validate_project_file_slot()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_type text;
BEGIN
  SELECT type INTO v_type FROM public.projects WHERE id = NEW.project_id FOR UPDATE;
  IF NEW.slot = 'BOM' AND v_type IS DISTINCT FROM 'HARDWARE' THEN
    RAISE EXCEPTION 'RESOURCE_SLOT_NOT_ALLOWED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 2. project_resources (owned by: files) - one current source per project slot
-- =============================================================================
CREATE TABLE public.project_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  slot text NOT NULL CHECK (slot IN ('SRS', 'FIRST_MEETING', 'BOM')),
  source_type text NOT NULL CHECK (source_type IN ('LINK', 'FILE')),
  url text CHECK (url IS NULL OR char_length(url) <= 2048),
  file_id uuid REFERENCES public.project_files(id) ON DELETE RESTRICT,
  label varchar(100) CHECK (label IS NULL OR label = btrim(label) AND char_length(label) > 0),
  updated_by_user_id uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,  -- NULL for migrated rows
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, slot),
  CONSTRAINT project_resources_one_source CHECK (
    (source_type = 'LINK' AND url ~ '^https://' AND file_id IS NULL)
    OR (source_type = 'FILE' AND file_id IS NOT NULL AND url IS NULL)),
  CONSTRAINT project_resources_first_meeting_link CHECK (slot <> 'FIRST_MEETING' OR source_type = 'LINK')
);

-- Carry existing data over: active files first, then links (a slot never had both).
INSERT INTO public.project_resources (project_id, slot, source_type, file_id, updated_by_user_id)
SELECT project_id, slot, 'FILE', id, uploaded_by_user_id
  FROM public.project_files WHERE status = 'ACTIVE';
INSERT INTO public.project_resources (project_id, slot, source_type, url, updated_by_user_id)
SELECT p.id, l.slot, 'LINK', l.url, p.created_by_user_id
  FROM public.projects p
  CROSS JOIN LATERAL (VALUES ('SRS', p.srs_external_url),
                             ('FIRST_MEETING', p.first_meeting_url),
                             ('BOM', p.bom_external_url)) AS l(slot, url)
 WHERE l.url IS NOT NULL
ON CONFLICT (project_id, slot) DO NOTHING;

CREATE FUNCTION public.validate_project_resource()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_type text; v_file public.project_files;
BEGIN
  SELECT type INTO v_type FROM public.projects WHERE id = NEW.project_id FOR UPDATE;
  IF NEW.slot = 'BOM' AND v_type IS DISTINCT FROM 'HARDWARE' THEN
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
CREATE TRIGGER project_resources_validate BEFORE INSERT OR UPDATE ON public.project_resources
FOR EACH ROW EXECUTE FUNCTION public.validate_project_resource();
CREATE TRIGGER project_resources_touch_updated_at BEFORE UPDATE ON public.project_resources
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.project_resources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.project_resources FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_resources TO service_role;

-- =============================================================================
-- 3. projects no longer stores slot URLs
-- =============================================================================
-- A HARDWARE project keeps its type while a BOM exists (link, pending or active file).
CREATE OR REPLACE FUNCTION public.validate_project_slots()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.type = 'HARDWARE' AND NEW.type <> 'HARDWARE' AND (
       EXISTS (SELECT 1 FROM public.project_resources WHERE project_id = NEW.id AND slot = 'BOM')
       OR EXISTS (SELECT 1 FROM public.project_files
                   WHERE project_id = NEW.id AND slot = 'BOM' AND status IN ('UPLOADING', 'ACTIVE'))) THEN
    RAISE EXCEPTION 'PROJECT_HAS_BOM' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.projects
  DROP COLUMN srs_external_url,
  DROP COLUMN first_meeting_url,
  DROP COLUMN bom_external_url;

-- =============================================================================
-- 4. Functions (all writes: admin_* / finalize_*, SECURITY DEFINER, audited)
-- =============================================================================
-- Locks the project and rejects missing/archived ones. Returns its type.
CREATE FUNCTION public.files_lock_project(p_project_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_project public.projects;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_project.archived_at IS NOT NULL THEN RAISE EXCEPTION 'PROJECT_ARCHIVED' USING ERRCODE = 'P0001'; END IF;
  RETURN v_project.type;
END;
$$;

-- ---------- Set / replace a link (FR-RES-01) ----------
CREATE FUNCTION public.admin_set_project_resource_link(
  p_actor_id uuid, p_project_id uuid, p_slot text, p_url text, p_label text, p_request_id text
) RETURNS public.project_resources
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_type text; v_row public.project_resources; v_retired uuid;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  v_type := public.files_lock_project(p_project_id);
  IF p_slot NOT IN ('SRS', 'FIRST_MEETING', 'BOM') THEN
    RAISE EXCEPTION 'INVALID_SLOT' USING ERRCODE = '22023';
  END IF;
  IF p_slot = 'BOM' AND v_type <> 'HARDWARE' THEN
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

-- ---------- Clear a slot ----------
CREATE FUNCTION public.admin_clear_project_resource(
  p_actor_id uuid, p_project_id uuid, p_slot text, p_request_id text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_deleted integer; v_retired uuid;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  PERFORM public.files_lock_project(p_project_id);
  UPDATE public.project_files SET status = 'RETIRED', retired_at = now()
   WHERE project_id = p_project_id AND slot = p_slot AND status = 'ACTIVE'
  RETURNING id INTO v_retired;
  DELETE FROM public.project_resources WHERE project_id = p_project_id AND slot = p_slot;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted = 0 THEN RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'RESOURCE_CLEARED', 'PROJECT', p_project_id,
          jsonb_strip_nulls(jsonb_build_object('slot', p_slot, 'retired_file_id', v_retired)), p_request_id);
  RETURN true;
END;
$$;

-- ---------- Upload, phase 1: register the pending file (FR-FILE-01) ----------
CREATE FUNCTION public.admin_begin_file_upload(
  p_actor_id uuid, p_project_id uuid, p_slot text, p_bucket_id text, p_object_path text,
  p_original_filename text, p_content_type text, p_size_bytes bigint, p_checksum_sha256 text
) RETURNS public.project_files
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_type text; v_row public.project_files;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  v_type := public.files_lock_project(p_project_id);
  IF p_slot NOT IN ('SRS', 'BOM') THEN
    RAISE EXCEPTION 'RESOURCE_SOURCE_NOT_ALLOWED' USING ERRCODE = 'P0001';
  END IF;
  IF p_slot = 'BOM' AND v_type <> 'HARDWARE' THEN
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

-- ---------- Upload, phase 2: activate, retire the previous file, point the slot ----------
CREATE FUNCTION public.finalize_file_upload(
  p_actor_id uuid, p_file_id uuid, p_request_id text
) RETURNS public.project_files
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_project_id uuid; v_file public.project_files; v_previous uuid;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  SELECT project_id INTO v_project_id FROM public.project_files WHERE id = p_file_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FILE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.files_lock_project(v_project_id);

  SELECT * INTO v_file FROM public.project_files WHERE id = p_file_id FOR UPDATE;
  IF v_file.status <> 'UPLOADING' THEN RAISE EXCEPTION 'FILE_NOT_PENDING' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.project_files SET status = 'RETIRED', retired_at = now()
   WHERE project_id = v_file.project_id AND slot = v_file.slot AND status = 'ACTIVE'
  RETURNING id INTO v_previous;
  UPDATE public.project_files SET status = 'ACTIVE' WHERE id = p_file_id RETURNING * INTO v_file;

  DELETE FROM public.project_resources WHERE project_id = v_file.project_id AND slot = v_file.slot;
  INSERT INTO public.project_resources (project_id, slot, source_type, file_id, updated_by_user_id)
  VALUES (v_file.project_id, v_file.slot, 'FILE', v_file.id, p_actor_id);

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, CASE WHEN v_previous IS NULL THEN 'FILE_UPLOADED' ELSE 'FILE_REPLACED' END,
          'PROJECT_FILE', v_file.id,
          jsonb_strip_nulls(jsonb_build_object('project_id', v_file.project_id, 'slot', v_file.slot,
            'size_bytes', v_file.size_bytes, 'previous_file_id', v_previous)), p_request_id);
  RETURN v_file;
END;
$$;

-- Upload failed before finalizing: drop the pending row.
CREATE FUNCTION public.admin_abort_file_upload(p_actor_id uuid, p_file_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_deleted integer;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  DELETE FROM public.project_files WHERE id = p_file_id AND status = 'UPLOADING';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

-- ---------- Orphan cleanup (internal job) ----------
CREATE FUNCTION public.list_orphan_uploads(p_older_than_minutes integer)
RETURNS TABLE (id uuid, bucket_id text, object_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT f.id, f.bucket_id, f.object_path FROM public.project_files f
   WHERE f.status = 'UPLOADING' AND f.created_at < now() - make_interval(mins => greatest(p_older_than_minutes, 1))
   ORDER BY f.created_at LIMIT 200;
$$;

CREATE FUNCTION public.delete_orphan_uploads(p_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.project_files WHERE id = ANY(p_ids) AND status = 'UPLOADING';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ---------- Download authorization (FR-FILE-02): no rows = not found / not allowed ----------
CREATE FUNCTION public.admin_get_project_file(p_actor_id uuid, p_project_id uuid, p_file_id uuid)
RETURNS TABLE (bucket_id text, object_path text, original_filename text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  RETURN QUERY
  SELECT f.bucket_id, f.object_path, f.original_filename FROM public.project_files f
   WHERE f.id = p_file_id AND f.project_id = p_project_id AND f.status IN ('ACTIVE', 'RETIRED');
END;
$$;

-- Active user + ACTIVE roster entry in the current semester + active assignment (SR-3).
CREATE FUNCTION public.member_get_project_file(p_actor_id uuid, p_project_id uuid, p_file_id uuid)
RETURNS TABLE (bucket_id text, object_path text, original_filename text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT f.bucket_id, f.object_path, f.original_filename
    FROM public.project_files f
    JOIN public.app_users u ON u.id = p_actor_id AND u.is_active
    JOIN public.semesters s ON s.is_current
    JOIN public.roster_members rm ON rm.user_id = u.id AND rm.semester_id = s.id AND rm.status = 'ACTIVE'
    JOIN public.project_members pm ON pm.roster_member_id = rm.id AND pm.project_id = f.project_id
                                  AND pm.removed_at IS NULL
   WHERE f.id = p_file_id AND f.project_id = p_project_id AND f.status = 'ACTIVE';
$$;

-- =============================================================================
-- 5. Privileges: backend (service_role) only
-- =============================================================================
REVOKE ALL ON FUNCTION public.validate_project_resource() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.files_lock_project(uuid) FROM PUBLIC, anon, authenticated;
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.admin_set_project_resource_link(uuid, uuid, text, text, text, text)',
    'public.admin_clear_project_resource(uuid, uuid, text, text)',
    'public.admin_begin_file_upload(uuid, uuid, text, text, text, text, text, bigint, text)',
    'public.finalize_file_upload(uuid, uuid, text)',
    'public.admin_abort_file_upload(uuid, uuid)',
    'public.list_orphan_uploads(integer)',
    'public.delete_orphan_uploads(uuid[])',
    'public.admin_get_project_file(uuid, uuid, uuid)',
    'public.member_get_project_file(uuid, uuid, uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
