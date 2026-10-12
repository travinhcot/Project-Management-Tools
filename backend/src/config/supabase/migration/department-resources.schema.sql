-- Department resources: a shared library per department (colour palette, brand guidelines, templates).
-- Apply after departments.schema.sql. Owner: department-resources. Backend (service_role) only.
--
-- Who may do what, inside ONE department's library:
--   MEMBER      an eligible member (active account + ACTIVE roster entry in the current semester) whose
--               roster entry is in that department: list, add, edit, replace, delete, download
--   DEPT_ADMIN  the department's admin: the same
--   ADMIN       the super-admin: the same, for the department they name (p_department_code)
-- Everyone edits the same rows, so the audit log records who changed what.
BEGIN;

-- =============================================================================
-- 1. Tables
-- =============================================================================
CREATE TABLE public.department_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  bucket_id text NOT NULL CHECK (length(btrim(bucket_id)) > 0),
  object_path text NOT NULL CHECK (length(btrim(object_path)) > 0),
  original_filename text NOT NULL CHECK (length(btrim(original_filename)) > 0),
  content_type varchar(255) NOT NULL CHECK (length(btrim(content_type)) > 0),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  checksum_sha256 text CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'UPLOADING' CHECK (status IN ('UPLOADING', 'ACTIVE', 'RETIRED')),
  uploaded_by_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  UNIQUE (bucket_id, object_path),
  UNIQUE (id, department_id),
  CONSTRAINT department_files_retired_consistent CHECK ((status = 'RETIRED') = (retired_at IS NOT NULL))
);
CREATE INDEX department_files_status_created ON public.department_files (status, created_at);

CREATE TABLE public.department_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  category varchar(50) NOT NULL DEFAULT 'General'
    CONSTRAINT department_resources_category_check CHECK (category = btrim(category) AND length(category) > 0),
  title varchar(150) NOT NULL
    CONSTRAINT department_resources_title_check CHECK (title = btrim(title) AND length(title) > 0),
  description varchar(500)
    CONSTRAINT department_resources_description_check CHECK (description IS NULL OR description = btrim(description)),
  source_type text NOT NULL CHECK (source_type IN ('LINK', 'FILE')),
  url text CHECK (url IS NULL OR (char_length(url) <= 2048 AND url ~ '^https://[^[:space:]]+$')),
  file_id uuid,
  created_by_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  updated_by_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (file_id, department_id) REFERENCES public.department_files(id, department_id) ON DELETE RESTRICT,
  CONSTRAINT department_resources_one_source CHECK (
    (source_type = 'LINK' AND url IS NOT NULL AND file_id IS NULL)
    OR (source_type = 'FILE' AND file_id IS NOT NULL AND url IS NULL))
);
CREATE INDEX department_resources_listing
  ON public.department_resources (department_id, lower(category), lower(title));
CREATE TRIGGER department_resources_touch_updated_at
BEFORE UPDATE ON public.department_resources
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.department_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_resources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.department_files FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.department_resources FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.department_files TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.department_resources TO service_role;

-- =============================================================================
-- 2. Which department's library may this actor use?
--    NULL / unknown department for an ADMIN raises DEPARTMENT_REQUIRED (22023).
-- =============================================================================
CREATE FUNCTION public.department_resource_scope(p_actor_id uuid, p_department_code text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user public.app_users;
  v_department uuid;
BEGIN
  SELECT * INTO v_user FROM public.app_users WHERE id = p_actor_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;

  IF v_user.role = 'ADMIN' THEN
    SELECT id INTO v_department FROM public.departments WHERE code = p_department_code;
    IF v_department IS NULL THEN RAISE EXCEPTION 'DEPARTMENT_REQUIRED' USING ERRCODE = '22023'; END IF;
    RETURN v_department;
  ELSIF v_user.role = 'DEPT_ADMIN' THEN
    IF p_department_code IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.departments WHERE id = v_user.department_id AND code = p_department_code) THEN
      RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    RETURN v_user.department_id;
  END IF;

  -- MEMBER: the department of their roster entry in the current semester.
  SELECT rm.department_id INTO v_department
    FROM public.member_eligibility(p_actor_id) e
    JOIN public.roster_members rm ON rm.id = e.roster_member_id;
  IF v_department IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  RETURN v_department;
END;
$$;

-- =============================================================================
-- 3. Read
-- =============================================================================
CREATE FUNCTION public.dept_resources_list(p_actor_id uuid, p_department_code text DEFAULT NULL)
RETURNS TABLE (
  id uuid, department_code text, category text, title text, description text, source_type text,
  url text, file_id uuid, original_filename text, content_type text, size_bytes bigint,
  updated_by_name text, created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_department uuid;
BEGIN
  v_department := public.department_resource_scope(p_actor_id, p_department_code);
  RETURN QUERY
  SELECT r.id, d.code::text, r.category::text, r.title::text, r.description::text, r.source_type,
         r.url, f.id, f.original_filename::text, f.content_type::text, f.size_bytes,
         u.full_name::text, r.created_at, r.updated_at
    FROM public.department_resources r
    JOIN public.departments d ON d.id = r.department_id
    LEFT JOIN public.department_files f ON f.id = r.file_id
    LEFT JOIN public.app_users u ON u.id = r.updated_by_user_id
   WHERE r.department_id = v_department
   ORDER BY lower(r.category), lower(r.title), r.id;
END;
$$;

-- Download authorization: no rows = not found / not allowed.
CREATE FUNCTION public.dept_resources_get_file(p_actor_id uuid, p_department_code text, p_resource_id uuid)
RETURNS TABLE (bucket_id text, object_path text, original_filename text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_department uuid;
BEGIN
  v_department := public.department_resource_scope(p_actor_id, p_department_code);
  RETURN QUERY
  SELECT f.bucket_id, f.object_path, f.original_filename::text
    FROM public.department_resources r
    JOIN public.department_files f ON f.id = r.file_id AND f.status = 'ACTIVE'
   WHERE r.id = p_resource_id AND r.department_id = v_department;
END;
$$;

-- =============================================================================
-- 4. Write
-- =============================================================================
CREATE FUNCTION public.dept_resources_create_link(
  p_actor_id uuid, p_department_code text, p_title text, p_category text, p_description text,
  p_url text, p_request_id text
) RETURNS public.department_resources
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_department uuid; v_row public.department_resources;
BEGIN
  v_department := public.department_resource_scope(p_actor_id, p_department_code);
  IF p_url IS NULL OR p_url !~ '^https://' THEN RAISE EXCEPTION 'INVALID_URL' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.department_resources
    (department_id, category, title, description, source_type, url, created_by_user_id, updated_by_user_id)
  VALUES (v_department, coalesce(nullif(btrim(p_category), ''), 'General'), btrim(p_title),
          nullif(btrim(p_description), ''), 'LINK', btrim(p_url), p_actor_id, p_actor_id)
  RETURNING * INTO v_row;
  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'DEPT_RESOURCE_CREATED', 'DEPARTMENT_RESOURCE', v_row.id,
          jsonb_build_object('department_id', v_department, 'title', v_row.title, 'source_type', 'LINK'),
          p_request_id);
  RETURN v_row;
END;
$$;

-- Phase 1 of a file upload: register a pending file (the object is put in Storage next).
CREATE FUNCTION public.dept_resources_begin_file(
  p_actor_id uuid, p_department_code text, p_bucket_id text, p_object_path text,
  p_original_filename text, p_content_type text, p_size_bytes bigint, p_checksum_sha256 text
) RETURNS public.department_files
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_department uuid; v_row public.department_files;
BEGIN
  v_department := public.department_resource_scope(p_actor_id, p_department_code);
  INSERT INTO public.department_files (department_id, bucket_id, object_path, original_filename,
                                       content_type, size_bytes, checksum_sha256, uploaded_by_user_id)
  VALUES (v_department, p_bucket_id, p_object_path, p_original_filename, p_content_type,
          p_size_bytes, p_checksum_sha256, p_actor_id)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- Phase 2: activate the file. p_resource_id NULL creates a resource (title required);
-- otherwise the file replaces the resource's current source (a link or an older file).
-- p_changes may also carry title / category / description.
CREATE FUNCTION public.dept_resources_finalize_file(
  p_actor_id uuid, p_department_code text, p_file_id uuid, p_resource_id uuid,
  p_changes jsonb, p_request_id text
) RETURNS public.department_resources
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_department uuid;
  v_file public.department_files;
  v_row public.department_resources;
  v_previous_file uuid;
  v_action text;
BEGIN
  v_department := public.department_resource_scope(p_actor_id, p_department_code);
  SELECT * INTO v_file FROM public.department_files
   WHERE id = p_file_id AND department_id = v_department AND uploaded_by_user_id = p_actor_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FILE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_file.status <> 'UPLOADING' THEN RAISE EXCEPTION 'FILE_NOT_PENDING' USING ERRCODE = 'P0001'; END IF;

  IF p_resource_id IS NULL THEN
    IF nullif(btrim(p_changes ->> 'title'), '') IS NULL THEN
      RAISE EXCEPTION 'TITLE_REQUIRED' USING ERRCODE = '22023';
    END IF;
    UPDATE public.department_files SET status = 'ACTIVE' WHERE id = p_file_id;
    INSERT INTO public.department_resources
      (department_id, category, title, description, source_type, file_id, created_by_user_id, updated_by_user_id)
    VALUES (v_department, coalesce(nullif(btrim(p_changes ->> 'category'), ''), 'General'),
            btrim(p_changes ->> 'title'), nullif(btrim(p_changes ->> 'description'), ''),
            'FILE', p_file_id, p_actor_id, p_actor_id)
    RETURNING * INTO v_row;
    v_action := 'DEPT_RESOURCE_CREATED';
  ELSE
    SELECT * INTO v_row FROM public.department_resources
     WHERE id = p_resource_id AND department_id = v_department FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
    v_previous_file := v_row.file_id;
    UPDATE public.department_files SET status = 'ACTIVE' WHERE id = p_file_id;
    UPDATE public.department_resources
       SET source_type = 'FILE', url = NULL, file_id = p_file_id, updated_by_user_id = p_actor_id,
           title = coalesce(nullif(btrim(p_changes ->> 'title'), ''), title),
           category = coalesce(nullif(btrim(p_changes ->> 'category'), ''), category),
           description = CASE WHEN p_changes ? 'description'
                              THEN nullif(btrim(p_changes ->> 'description'), '') ELSE description END
     WHERE id = p_resource_id
    RETURNING * INTO v_row;
    IF v_previous_file IS NOT NULL THEN
      UPDATE public.department_files SET status = 'RETIRED', retired_at = now() WHERE id = v_previous_file;
    END IF;
    v_action := 'DEPT_RESOURCE_FILE_REPLACED';
  END IF;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, v_action, 'DEPARTMENT_RESOURCE', v_row.id,
          jsonb_strip_nulls(jsonb_build_object('department_id', v_department, 'title', v_row.title,
            'source_type', 'FILE', 'size_bytes', v_file.size_bytes, 'previous_file_id', v_previous_file)),
          p_request_id);
  RETURN v_row;
END;
$$;

CREATE FUNCTION public.dept_resources_abort_file(p_actor_id uuid, p_department_code text, p_file_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_department uuid; v_deleted integer;
BEGIN
  v_department := public.department_resource_scope(p_actor_id, p_department_code);
  DELETE FROM public.department_files
   WHERE id = p_file_id AND department_id = v_department AND uploaded_by_user_id = p_actor_id
     AND status = 'UPLOADING';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

-- Edit the text fields; for a LINK resource also its url. p_changes keys: title, category,
-- description (null clears), url.
CREATE FUNCTION public.dept_resources_update(
  p_actor_id uuid, p_department_code text, p_resource_id uuid, p_changes jsonb, p_request_id text
) RETURNS public.department_resources
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_department uuid; v_before public.department_resources; v_row public.department_resources;
BEGIN
  v_department := public.department_resource_scope(p_actor_id, p_department_code);
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_changes) k
                 WHERE k NOT IN ('title', 'category', 'description', 'url')) THEN
    RAISE EXCEPTION 'NO_CHANGES' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_before FROM public.department_resources
   WHERE id = p_resource_id AND department_id = v_department FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF p_changes ? 'url' AND v_before.source_type <> 'LINK' THEN
    RAISE EXCEPTION 'RESOURCE_NOT_A_LINK' USING ERRCODE = 'P0001';
  END IF;
  IF p_changes ? 'url' AND (p_changes ->> 'url') IS NULL THEN
    RAISE EXCEPTION 'INVALID_URL' USING ERRCODE = '22023';
  END IF;

  UPDATE public.department_resources
     SET title = CASE WHEN p_changes ? 'title' THEN btrim(p_changes ->> 'title') ELSE title END,
         category = CASE WHEN p_changes ? 'category'
                         THEN coalesce(nullif(btrim(p_changes ->> 'category'), ''), 'General') ELSE category END,
         description = CASE WHEN p_changes ? 'description'
                            THEN nullif(btrim(p_changes ->> 'description'), '') ELSE description END,
         url = CASE WHEN p_changes ? 'url' THEN btrim(p_changes ->> 'url') ELSE url END,
         updated_by_user_id = p_actor_id
   WHERE id = p_resource_id
  RETURNING * INTO v_row;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'DEPT_RESOURCE_UPDATED', 'DEPARTMENT_RESOURCE', v_row.id,
          jsonb_build_object('department_id', v_department,
            'fields', (SELECT jsonb_agg(k ORDER BY k) FROM jsonb_object_keys(p_changes) k)),
          p_request_id);
  RETURN v_row;
END;
$$;

-- Removes the resource; a stored file is retired (the object stays in Storage, undownloadable).
CREATE FUNCTION public.dept_resources_delete(
  p_actor_id uuid, p_department_code text, p_resource_id uuid, p_request_id text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_department uuid; v_row public.department_resources;
BEGIN
  v_department := public.department_resource_scope(p_actor_id, p_department_code);
  SELECT * INTO v_row FROM public.department_resources
   WHERE id = p_resource_id AND department_id = v_department FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  DELETE FROM public.department_resources WHERE id = p_resource_id;
  IF v_row.file_id IS NOT NULL THEN
    UPDATE public.department_files SET status = 'RETIRED', retired_at = now() WHERE id = v_row.file_id;
  END IF;
  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'DEPT_RESOURCE_DELETED', 'DEPARTMENT_RESOURCE', p_resource_id,
          jsonb_build_object('department_id', v_department, 'title', v_row.title,
                             'source_type', v_row.source_type),
          p_request_id);
  RETURN true;
END;
$$;

-- =============================================================================
-- 5. Orphan cleanup (internal job): uploads that never finished
-- =============================================================================
CREATE FUNCTION public.list_orphan_department_uploads(p_older_than_minutes integer)
RETURNS TABLE (id uuid, bucket_id text, object_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT f.id, f.bucket_id, f.object_path FROM public.department_files f
   WHERE f.status = 'UPLOADING'
     AND f.created_at < now() - make_interval(mins => greatest(p_older_than_minutes, 1))
   ORDER BY f.created_at LIMIT 200;
$$;

CREATE FUNCTION public.delete_orphan_department_uploads(p_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.department_files WHERE id = ANY (p_ids) AND status = 'UPLOADING';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- =============================================================================
-- 6. Privileges: backend (service_role) only
-- =============================================================================
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.department_resource_scope(uuid, text)',
    'public.dept_resources_list(uuid, text)',
    'public.dept_resources_get_file(uuid, text, uuid)',
    'public.dept_resources_create_link(uuid, text, text, text, text, text, text)',
    'public.dept_resources_begin_file(uuid, text, text, text, text, text, bigint, text)',
    'public.dept_resources_finalize_file(uuid, text, uuid, uuid, jsonb, text)',
    'public.dept_resources_abort_file(uuid, text, uuid)',
    'public.dept_resources_update(uuid, text, uuid, jsonb, text)',
    'public.dept_resources_delete(uuid, text, uuid, text)',
    'public.list_orphan_department_uploads(integer)',
    'public.delete_orphan_department_uploads(uuid[])'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
