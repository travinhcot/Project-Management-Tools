-- Semesters (FR-SEM-01/02) and Roster (FR-ROS-01..05).
-- Apply after app-user, platform-tables and user-management. ALTER-based: safe on a DB
-- that already has the platform tables and seed data.
BEGIN;

-- =============================================================================
-- 0. Platform helper: caller re-check. Reads app_users (owned by users) only to
--    authorize; same rule as audit_events: any module's SQL function may call it.
-- =============================================================================
CREATE FUNCTION public.assert_admin_actor(p_actor_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.app_users WHERE id = p_actor_id AND role = 'ADMIN' AND is_active
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- =============================================================================
-- 1. semesters (owned by: semesters)
--    A semester = one term (A, B or C) of one academic year. Exactly one may be
--    flagged is_current; that one decides member eligibility/visibility (D-05).
-- =============================================================================
ALTER TABLE public.semesters
  ADD COLUMN term text CONSTRAINT semesters_term_check CHECK (term IN ('A', 'B', 'C')),
  ADD COLUMN year smallint CONSTRAINT semesters_year_check CHECK (year BETWEEN 2000 AND 2100),
  ADD COLUMN starts_on date,
  ADD COLUMN ends_on date,
  ADD CONSTRAINT semesters_dates_ordered
    CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on);

-- Backfill term/year from names like "Semester A 2026 - Seed" or "Sem B 2026".
UPDATE public.semesters
   SET term = upper((regexp_match(name, '(?i)\ysem(?:ester)?\s*([abc])\y\D*((?:19|20)\d{2})'))[1]),
       year = (regexp_match(name, '(?i)\ysem(?:ester)?\s*([abc])\y\D*((?:19|20)\d{2})'))[2]::smallint;
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(quote_literal(name), ', ') INTO bad FROM public.semesters WHERE term IS NULL OR year IS NULL;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Rename these semesters to "Sem <A|B|C> <year>" (or delete them) before migrating: %', bad;
  END IF;
END;
$$;
ALTER TABLE public.semesters ALTER COLUMN term SET NOT NULL, ALTER COLUMN year SET NOT NULL;

-- The display name is derived, so it can never disagree with term/year.
DROP INDEX public.semesters_name_unique;
ALTER TABLE public.semesters DROP COLUMN name;
ALTER TABLE public.semesters
  ADD COLUMN name varchar(20) GENERATED ALWAYS AS ('Sem ' || term || ' ' || year::text) STORED;
ALTER TABLE public.semesters ADD CONSTRAINT semesters_year_term_unique UNIQUE (year, term);

-- I-04: the schedule lives only in email_campaigns.
ALTER TABLE public.semesters DROP COLUMN demo_scheduled_at;
ALTER TABLE public.semesters RENAME COLUMN is_active TO is_current;   -- keeps the one-current index
ALTER INDEX public.semesters_one_active RENAME TO semesters_one_current;

CREATE FUNCTION public.admin_create_semester(
  p_actor_id uuid, p_term text, p_year integer, p_starts_on date, p_ends_on date,
  p_demo_registration_url text, p_request_id text
) RETURNS public.semesters
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_row public.semesters;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  INSERT INTO public.semesters (term, year, starts_on, ends_on, demo_registration_url)
  VALUES (p_term, p_year, p_starts_on, p_ends_on, p_demo_registration_url)
  RETURNING * INTO v_row;                                   -- duplicate (year, term) -> 23505

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'SEMESTER_CREATED', 'SEMESTER', v_row.id,
          jsonb_build_object('name', v_row.name), p_request_id);
  RETURN v_row;
END;
$$;

-- p_changes: any subset of {term, year, starts_on, ends_on, demo_registration_url}.
-- A present key with JSON null clears starts_on/ends_on/demo_registration_url.
CREATE FUNCTION public.admin_update_semester(
  p_actor_id uuid, p_semester_id uuid, p_changes jsonb, p_request_id text
) RETURNS public.semesters
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_row public.semesters;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_changes) k
                 WHERE k NOT IN ('term', 'year', 'starts_on', 'ends_on', 'demo_registration_url')) THEN
    RAISE EXCEPTION 'NO_CHANGES' USING ERRCODE = '22023';
  END IF;

  UPDATE public.semesters SET
    term = CASE WHEN p_changes ? 'term' THEN p_changes->>'term' ELSE term END,
    year = CASE WHEN p_changes ? 'year' THEN (p_changes->>'year')::smallint ELSE year END,
    starts_on = CASE WHEN p_changes ? 'starts_on' THEN (p_changes->>'starts_on')::date ELSE starts_on END,
    ends_on = CASE WHEN p_changes ? 'ends_on' THEN (p_changes->>'ends_on')::date ELSE ends_on END,
    demo_registration_url = CASE WHEN p_changes ? 'demo_registration_url'
                                 THEN p_changes->>'demo_registration_url' ELSE demo_registration_url END
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

-- Make the target the single current semester (the old one is un-flagged), atomically.
CREATE FUNCTION public.admin_set_current_semester(
  p_actor_id uuid, p_semester_id uuid, p_request_id text
) RETURNS public.semesters
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_target public.semesters;
  v_previous uuid;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  PERFORM pg_advisory_xact_lock(hashtext('semesters.current'));

  SELECT * INTO v_target FROM public.semesters WHERE id = p_semester_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEMESTER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_target.is_current THEN
    RAISE EXCEPTION 'SEMESTER_ALREADY_CURRENT' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.semesters SET is_current = false WHERE is_current RETURNING id INTO v_previous;
  UPDATE public.semesters SET is_current = true WHERE id = p_semester_id RETURNING * INTO v_target;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'SEMESTER_SET_CURRENT', 'SEMESTER', p_semester_id,
          jsonb_build_object('name', v_target.name, 'previous_current_semester_id', v_previous), p_request_id);
  RETURN v_target;
END;
$$;

-- =============================================================================
-- 2. roster_imports + roster_import_rows (owned by: roster/imports)
-- =============================================================================
ALTER TABLE public.roster_imports
  DROP CONSTRAINT roster_imports_status_check,
  DROP CONSTRAINT roster_imports_check,
  DROP CONSTRAINT roster_imports_semester_id_file_checksum_key;  -- same file may be previewed again
ALTER TABLE public.roster_imports RENAME COLUMN accepted_rows TO valid_rows;
ALTER TABLE public.roster_imports RENAME COLUMN rejected_rows TO invalid_rows;
ALTER TABLE public.roster_imports RENAME COLUMN completed_at TO committed_at;

UPDATE public.roster_imports
   SET status = CASE status WHEN 'COMPLETED' THEN 'COMMITTED' ELSE 'FAILED' END;

ALTER TABLE public.roster_imports
  ADD COLUMN update_rows integer NOT NULL DEFAULT 0 CHECK (update_rows >= 0),
  ADD COLUMN deactivate_missing boolean NOT NULL DEFAULT false,
  ADD COLUMN deactivated_rows integer NOT NULL DEFAULT 0 CHECK (deactivated_rows >= 0),
  ADD COLUMN expires_at timestamptz,
  ADD CONSTRAINT roster_imports_status_check
    CHECK (status IN ('PREVIEWED', 'COMMITTED', 'FAILED', 'EXPIRED')),
  ADD CONSTRAINT roster_imports_counts_check
    CHECK (valid_rows::bigint + update_rows + invalid_rows <= total_rows),
  ADD CONSTRAINT roster_imports_preview_expiry
    CHECK (status <> 'PREVIEWED' OR expires_at IS NOT NULL);
CREATE INDEX roster_imports_semester_time ON public.roster_imports (semester_id, created_at DESC);

CREATE TABLE public.roster_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.roster_imports(id) ON DELETE CASCADE,
  row_number integer NOT NULL CHECK (row_number >= 2),          -- spreadsheet row; 1 = header
  full_name varchar(200),
  email varchar(320),
  normalized_email varchar(320),
  other_info jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(other_info) = 'object'),
  status text NOT NULL CHECK (status IN ('VALID', 'UPDATE', 'INVALID', 'DUPLICATE')),
  errors jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(errors) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (import_id, row_number),
  CHECK (normalized_email IS NULL OR normalized_email = lower(btrim(email))),
  CHECK (status NOT IN ('VALID', 'UPDATE') OR (full_name IS NOT NULL AND normalized_email IS NOT NULL))
);
CREATE INDEX roster_import_rows_import_status ON public.roster_import_rows (import_id, status, row_number);
CREATE INDEX roster_import_rows_import_email ON public.roster_import_rows (import_id, normalized_email);
-- Commit upserts each email once; TypeScript marks every repeated email DUPLICATE.
CREATE UNIQUE INDEX roster_import_rows_one_valid_email
  ON public.roster_import_rows (import_id, normalized_email) WHERE status IN ('VALID', 'UPDATE');

-- =============================================================================
-- 3. roster_members (owned by: roster/members)
-- =============================================================================
ALTER TABLE public.roster_members
  ADD COLUMN status text NOT NULL DEFAULT 'ACTIVE'
    CONSTRAINT roster_members_status_check CHECK (status IN ('ACTIVE', 'INACTIVE')),
  ADD COLUMN deactivated_at timestamptz,
  ADD COLUMN deactivated_by_user_id uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  ADD COLUMN deactivation_reason varchar(500),
  ADD COLUMN last_import_id uuid REFERENCES public.roster_imports(id) ON DELETE SET NULL;

UPDATE public.roster_members SET status = 'INACTIVE', deactivated_at = updated_at WHERE NOT is_active;

ALTER TABLE public.roster_members
  DROP COLUMN is_active,
  ADD CONSTRAINT roster_members_deactivation_consistent
    CHECK ((status = 'ACTIVE') = (deactivated_at IS NULL));
CREATE INDEX roster_members_semester_status ON public.roster_members (semester_id, status);

-- Same as before, plus: email and semester are immutable (FR-ROS-04: delete-and-re-add).
CREATE OR REPLACE FUNCTION public.prepare_roster_member()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE account_email text;
BEGIN
  NEW.email := btrim(NEW.email);
  NEW.normalized_email := lower(NEW.email);
  NEW.full_name := btrim(NEW.full_name);
  IF TG_OP = 'UPDATE' AND (NEW.normalized_email IS DISTINCT FROM OLD.normalized_email
                           OR NEW.semester_id IS DISTINCT FROM OLD.semester_id) THEN
    RAISE EXCEPTION 'ROSTER_IDENTITY_IMMUTABLE' USING ERRCODE = '22023';
  END IF;
  IF NEW.user_id IS NOT NULL THEN
    SELECT normalized_email INTO account_email FROM public.app_users WHERE id = NEW.user_id;
    IF account_email IS DISTINCT FROM NEW.normalized_email THEN
      RAISE EXCEPTION 'Roster email must match the linked application profile';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Lock the semester row (FOR SHARE) so it cannot be deleted/relabelled mid-write.
-- Reads semesters (owned by semesters) only as the FK parent; never writes it.
CREATE FUNCTION public.roster_lock_semester(p_semester_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM 1 FROM public.semesters WHERE id = p_semester_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SEMESTER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- ---------- Roster list (FR-ROS-03) ----------
CREATE FUNCTION public.admin_list_roster(
  p_semester_id uuid, p_search text, p_status text, p_linked boolean,
  p_limit integer, p_offset integer
) RETURNS TABLE (
  id uuid, semester_id uuid, user_id uuid, email varchar, full_name varchar,
  other_info jsonb, status text, deactivated_at timestamptz, deactivation_reason varchar,
  last_import_id uuid, created_at timestamptz, updated_at timestamptz, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.semesters s WHERE s.id = p_semester_id) THEN
    RAISE EXCEPTION 'SEMESTER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  RETURN QUERY
  SELECT m.id, m.semester_id, m.user_id, m.email, m.full_name, m.other_info, m.status,
         m.deactivated_at, m.deactivation_reason, m.last_import_id, m.created_at, m.updated_at,
         count(*) OVER ()
    FROM public.roster_members m
   WHERE m.semester_id = p_semester_id
     AND (p_search IS NULL
          OR strpos(m.normalized_email, lower(p_search)) > 0
          OR strpos(lower(m.full_name), lower(p_search)) > 0)
     AND (p_status IS NULL OR m.status = p_status)
     AND (p_linked IS NULL OR (m.user_id IS NOT NULL) = p_linked)
   ORDER BY lower(m.full_name), m.id
   LIMIT least(greatest(p_limit, 1), 100)
  OFFSET greatest(p_offset, 0);
END;
$$;

-- ---------- Add single entry (FR-ROS-04) ----------
CREATE FUNCTION public.admin_add_roster_member(
  p_actor_id uuid, p_semester_id uuid, p_email text, p_full_name text,
  p_other_info jsonb, p_request_id text
) RETURNS public.roster_members
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_row public.roster_members;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  PERFORM public.roster_lock_semester(p_semester_id);

  INSERT INTO public.roster_members (semester_id, user_id, email, normalized_email, full_name, other_info)
  VALUES (p_semester_id,
          (SELECT u.id FROM public.app_users u WHERE u.normalized_email = lower(btrim(p_email))),
          p_email, lower(btrim(p_email)), p_full_name, coalesce(p_other_info, '{}'::jsonb))
  RETURNING * INTO v_row;   -- duplicate email in semester -> 23505

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'ROSTER_MEMBER_ADDED', 'ROSTER_MEMBER', v_row.id,
          jsonb_build_object('semester_id', p_semester_id, 'linked', v_row.user_id IS NOT NULL),
          p_request_id);
  RETURN v_row;
END;
$$;

-- ---------- Edit / status (FR-ROS-04) ----------
-- p_changes: subset of {full_name, other_info, status, deactivation_reason}.
CREATE FUNCTION public.admin_update_roster_member(
  p_actor_id uuid, p_roster_member_id uuid, p_changes jsonb, p_request_id text
) RETURNS public.roster_members
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_before public.roster_members;
  v_after  public.roster_members;
  v_status text;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_changes) k
                 WHERE k NOT IN ('full_name', 'other_info', 'status', 'deactivation_reason')) THEN
    RAISE EXCEPTION 'NO_CHANGES' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before FROM public.roster_members WHERE id = p_roster_member_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROSTER_MEMBER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  v_status := coalesce(p_changes->>'status', v_before.status);

  UPDATE public.roster_members SET
    full_name  = CASE WHEN p_changes ? 'full_name' THEN p_changes->>'full_name' ELSE full_name END,
    other_info = CASE WHEN p_changes ? 'other_info' THEN p_changes->'other_info' ELSE other_info END,
    status = v_status,
    deactivated_at = CASE
      WHEN v_status = 'ACTIVE' THEN NULL
      WHEN v_before.status = 'ACTIVE' THEN now()
      ELSE deactivated_at END,
    deactivated_by_user_id = CASE
      WHEN v_status = 'ACTIVE' THEN NULL
      WHEN v_before.status = 'ACTIVE' THEN p_actor_id
      ELSE deactivated_by_user_id END,
    deactivation_reason = CASE
      WHEN v_status = 'ACTIVE' THEN NULL
      WHEN p_changes ? 'deactivation_reason' THEN p_changes->>'deactivation_reason'
      ELSE deactivation_reason END
  WHERE id = p_roster_member_id
  RETURNING * INTO v_after;

  IF v_after.status IS DISTINCT FROM v_before.status THEN
    INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
    VALUES (p_actor_id,
            CASE WHEN v_after.status = 'ACTIVE' THEN 'ROSTER_MEMBER_REACTIVATED' ELSE 'ROSTER_MEMBER_DEACTIVATED' END,
            'ROSTER_MEMBER', v_after.id,
            jsonb_build_object('semester_id', v_after.semester_id), p_request_id);
  END IF;
  IF p_changes ? 'full_name' OR p_changes ? 'other_info' THEN
    INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
    VALUES (p_actor_id, 'ROSTER_MEMBER_UPDATED', 'ROSTER_MEMBER', v_after.id,
            jsonb_build_object('semester_id', v_after.semester_id,
              'fields', (SELECT jsonb_agg(k ORDER BY k) FROM jsonb_object_keys(p_changes) k
                          WHERE k IN ('full_name', 'other_info'))),
            p_request_id);
  END IF;
  RETURN v_after;
END;
$$;

-- ---------- Import preview (FR-ROS-01) ----------
-- p_rows: [{row_number, full_name, email, other_info, status: VALID|INVALID|DUPLICATE, errors: [...]}]
-- Parsing and per-row validation happen in TypeScript; this function only stores the
-- preview and upgrades VALID -> UPDATE for emails already in the semester.
CREATE FUNCTION public.roster_create_import_preview(
  p_actor_id uuid, p_semester_id uuid, p_filename text, p_checksum text,
  p_rows jsonb, p_request_id text
) RETURNS public.roster_imports
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_import public.roster_imports;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  PERFORM public.roster_lock_semester(p_semester_id);
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0
     OR jsonb_array_length(p_rows) > 5000 THEN
    RAISE EXCEPTION 'INVALID_ROWS' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.roster_imports
    (semester_id, initiated_by_user_id, filename, file_checksum, status, expires_at)
  VALUES (p_semester_id, p_actor_id, p_filename, p_checksum, 'PREVIEWED', now() + interval '30 minutes')
  RETURNING * INTO v_import;

  INSERT INTO public.roster_import_rows
    (import_id, row_number, full_name, email, normalized_email, other_info, status, errors)
  SELECT v_import.id, r.row_number, nullif(btrim(r.full_name), ''), nullif(btrim(r.email), ''),
         nullif(lower(btrim(r.email)), ''), coalesce(r.other_info, '{}'::jsonb),
         CASE WHEN r.status = 'VALID' AND EXISTS (
                SELECT 1 FROM public.roster_members m
                 WHERE m.semester_id = p_semester_id AND m.normalized_email = lower(btrim(r.email)))
              THEN 'UPDATE' ELSE r.status END,
         coalesce(r.errors, '[]'::jsonb)
    FROM jsonb_to_recordset(p_rows)
      AS r(row_number integer, full_name text, email text, other_info jsonb, status text, errors jsonb);

  UPDATE public.roster_imports i SET
    total_rows   = c.total,
    valid_rows   = c.valid,
    update_rows  = c.updates,
    invalid_rows = c.invalid
  FROM (SELECT count(*) AS total,
               count(*) FILTER (WHERE status = 'VALID')  AS valid,
               count(*) FILTER (WHERE status = 'UPDATE') AS updates,
               count(*) FILTER (WHERE status IN ('INVALID', 'DUPLICATE')) AS invalid
          FROM public.roster_import_rows WHERE import_id = v_import.id) c
  WHERE i.id = v_import.id
  RETURNING i.* INTO v_import;
  RETURN v_import;
END;
$$;

-- Import summary with effective status (PREVIEWED past expires_at reads as EXPIRED)
-- and how many ACTIVE members are not in the file (FR-ROS-05).
CREATE FUNCTION public.admin_get_roster_import(p_import_id uuid)
RETURNS TABLE (
  id uuid, semester_id uuid, initiated_by_user_id uuid, filename text, status text,
  total_rows integer, valid_rows integer, update_rows integer, invalid_rows integer,
  missing_active_rows bigint, deactivate_missing boolean, deactivated_rows integer,
  expires_at timestamptz, created_at timestamptz, committed_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT i.id, i.semester_id, i.initiated_by_user_id, i.filename,
         CASE WHEN i.status = 'PREVIEWED' AND i.expires_at <= now() THEN 'EXPIRED' ELSE i.status END,
         i.total_rows, i.valid_rows, i.update_rows, i.invalid_rows,
         (SELECT count(*) FROM public.roster_members m
           WHERE m.semester_id = i.semester_id AND m.status = 'ACTIVE'
             AND NOT EXISTS (SELECT 1 FROM public.roster_import_rows r
                              WHERE r.import_id = i.id AND r.normalized_email = m.normalized_email)),
         i.deactivate_missing, i.deactivated_rows, i.expires_at, i.created_at, i.committed_at
    FROM public.roster_imports i
   WHERE i.id = p_import_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'IMPORT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- ACTIVE members of the import's semester that are not in the file (FR-ROS-05 preview list).
CREATE FUNCTION public.admin_list_import_missing(p_import_id uuid, p_limit integer, p_offset integer)
RETURNS TABLE (id uuid, email varchar, full_name varchar, user_id uuid, total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_semester uuid;
BEGIN
  SELECT i.semester_id INTO v_semester FROM public.roster_imports i WHERE i.id = p_import_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'IMPORT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  RETURN QUERY
  SELECT m.id, m.email, m.full_name, m.user_id, count(*) OVER ()
    FROM public.roster_members m
   WHERE m.semester_id = v_semester AND m.status = 'ACTIVE'
     AND NOT EXISTS (SELECT 1 FROM public.roster_import_rows r
                      WHERE r.import_id = p_import_id AND r.normalized_email = m.normalized_email)
   ORDER BY lower(m.full_name), m.id
   LIMIT least(greatest(p_limit, 1), 100)
  OFFSET greatest(p_offset, 0);
END;
$$;

-- ---------- Commit (FR-ROS-02, FR-ROS-05) ----------
CREATE FUNCTION public.roster_commit_import(
  p_actor_id uuid, p_import_id uuid, p_deactivate_missing boolean, p_request_id text
) RETURNS public.roster_imports
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_import public.roster_imports;
  v_inserted integer;
  v_updated integer;
  v_deactivated integer := 0;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);

  SELECT * INTO v_import FROM public.roster_imports WHERE id = p_import_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'IMPORT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_import.status <> 'PREVIEWED' THEN
    RAISE EXCEPTION 'IMPORT_NOT_PREVIEWED' USING ERRCODE = 'P0001';
  END IF;
  IF v_import.expires_at <= now() THEN
    RAISE EXCEPTION 'IMPORT_EXPIRED' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.roster_lock_semester(v_import.semester_id);

  IF NOT EXISTS (SELECT 1 FROM public.roster_import_rows
                  WHERE import_id = p_import_id AND status IN ('VALID', 'UPDATE')) THEN
    RAISE EXCEPTION 'IMPORT_HAS_NO_VALID_ROWS' USING ERRCODE = 'P0001';
  END IF;

  -- Upsert valid rows; link to an existing app user by email (FR-AUTH-03 rule).
  -- Status is not changed by import: an INACTIVE member in the file stays INACTIVE.
  WITH upserted AS (
    INSERT INTO public.roster_members
      (semester_id, user_id, email, normalized_email, full_name, other_info, last_import_id)
    SELECT v_import.semester_id, u.id, r.email, r.normalized_email, r.full_name, r.other_info, p_import_id
      FROM public.roster_import_rows r
      LEFT JOIN public.app_users u ON u.normalized_email = r.normalized_email
     WHERE r.import_id = p_import_id AND r.status IN ('VALID', 'UPDATE')
    ON CONFLICT (semester_id, normalized_email) DO UPDATE SET
      full_name      = EXCLUDED.full_name,
      other_info     = public.roster_members.other_info || EXCLUDED.other_info,
      last_import_id = EXCLUDED.last_import_id,
      user_id        = coalesce(public.roster_members.user_id, EXCLUDED.user_id)
    RETURNING (xmax = 0) AS inserted
  )
  SELECT count(*) FILTER (WHERE inserted), count(*) FILTER (WHERE NOT inserted)
    INTO v_inserted, v_updated FROM upserted;

  IF coalesce(p_deactivate_missing, false) THEN
    UPDATE public.roster_members m SET
      status = 'INACTIVE', deactivated_at = now(), deactivated_by_user_id = p_actor_id,
      deactivation_reason = 'Missing from roster import'
     WHERE m.semester_id = v_import.semester_id AND m.status = 'ACTIVE'
       AND NOT EXISTS (SELECT 1 FROM public.roster_import_rows r
                        WHERE r.import_id = p_import_id AND r.normalized_email = m.normalized_email);
    GET DIAGNOSTICS v_deactivated = ROW_COUNT;
  END IF;

  UPDATE public.roster_imports SET
    status = 'COMMITTED', committed_at = now(),
    valid_rows = v_inserted, update_rows = v_updated,
    deactivate_missing = coalesce(p_deactivate_missing, false), deactivated_rows = v_deactivated
  WHERE id = p_import_id
  RETURNING * INTO v_import;

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'ROSTER_IMPORTED', 'ROSTER_IMPORT', p_import_id,
          jsonb_build_object('semester_id', v_import.semester_id, 'inserted', v_inserted,
                             'updated', v_updated, 'invalid', v_import.invalid_rows,
                             'deactivated', v_deactivated),
          p_request_id);
  RETURN v_import;
END;
$$;

-- =============================================================================
-- 4. Privileges: backend (service_role) only
-- =============================================================================
ALTER TABLE public.roster_import_rows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.roster_import_rows FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.roster_import_rows TO service_role;

REVOKE ALL ON FUNCTION public.assert_admin_actor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.roster_lock_semester(uuid) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.admin_create_semester(uuid, text, integer, date, date, text, text)',
    'public.admin_update_semester(uuid, uuid, jsonb, text)',
    'public.admin_set_current_semester(uuid, uuid, text)',
    'public.admin_list_roster(uuid, text, text, boolean, integer, integer)',
    'public.admin_add_roster_member(uuid, uuid, text, text, jsonb, text)',
    'public.admin_update_roster_member(uuid, uuid, jsonb, text)',
    'public.roster_create_import_preview(uuid, uuid, text, text, jsonb, text)',
    'public.admin_get_roster_import(uuid)',
    'public.admin_list_import_missing(uuid, integer, integer)',
    'public.roster_commit_import(uuid, uuid, boolean, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
