-- Roster members: department and birth year as real, filterable columns.
-- Apply after semesters-roster.schema.sql. other_info stays for student_id only.
BEGIN;

ALTER TABLE public.roster_members
  ADD COLUMN department varchar(100)
    CONSTRAINT roster_members_department_check CHECK (department IS NULL OR length(btrim(department)) > 0),
  ADD COLUMN birth_year smallint
    CONSTRAINT roster_members_birth_year_check CHECK (birth_year IS NULL OR birth_year BETWEEN 1900 AND 2100);

ALTER TABLE public.roster_import_rows
  ADD COLUMN department varchar(100),
  ADD COLUMN birth_year smallint;

-- Best-effort backfill from keys that may have been stored in other_info by hand.
UPDATE public.roster_members SET
  department = nullif(left(btrim(other_info->>'department'), 100), ''),
  birth_year = CASE WHEN other_info->>'birth_year' ~ '^[0-9]{4}$'
                     AND (other_info->>'birth_year')::integer BETWEEN 1900 AND 2100
                    THEN (other_info->>'birth_year')::smallint END
 WHERE other_info ? 'department' OR other_info ? 'birth_year';

CREATE INDEX roster_members_semester_department ON public.roster_members (semester_id, department);

-- ---------- List: department / birth_year filters and columns ----------
DROP FUNCTION public.admin_list_roster(uuid, text, text, boolean, integer, integer);
CREATE FUNCTION public.admin_list_roster(
  p_semester_id uuid, p_search text, p_status text, p_linked boolean,
  p_department text, p_birth_year integer, p_limit integer, p_offset integer
) RETURNS TABLE (
  id uuid, semester_id uuid, user_id uuid, email varchar, full_name varchar,
  other_info jsonb, department varchar, birth_year smallint,
  status text, deactivated_at timestamptz, deactivation_reason varchar,
  last_import_id uuid, created_at timestamptz, updated_at timestamptz, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.semesters s WHERE s.id = p_semester_id) THEN
    RAISE EXCEPTION 'SEMESTER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  RETURN QUERY
  SELECT m.id, m.semester_id, m.user_id, m.email, m.full_name, m.other_info,
         m.department, m.birth_year, m.status,
         m.deactivated_at, m.deactivation_reason, m.last_import_id, m.created_at, m.updated_at,
         count(*) OVER ()
    FROM public.roster_members m
   WHERE m.semester_id = p_semester_id
     AND (p_search IS NULL
          OR strpos(m.normalized_email, lower(p_search)) > 0
          OR strpos(lower(m.full_name), lower(p_search)) > 0)
     AND (p_status IS NULL OR m.status = p_status)
     AND (p_linked IS NULL OR (m.user_id IS NOT NULL) = p_linked)
     AND (p_department IS NULL OR lower(m.department) = lower(p_department))
     AND (p_birth_year IS NULL OR m.birth_year = p_birth_year)
   ORDER BY lower(m.full_name), m.id
   LIMIT least(greatest(p_limit, 1), 100)
  OFFSET greatest(p_offset, 0);
END;
$$;

-- ---------- Distinct departments of a semester (for the filter dropdown) ----------
CREATE FUNCTION public.admin_list_roster_departments(p_semester_id uuid)
RETURNS TABLE (department varchar)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.semesters s WHERE s.id = p_semester_id) THEN
    RAISE EXCEPTION 'SEMESTER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  RETURN QUERY
  SELECT d.department FROM (
    SELECT DISTINCT ON (lower(m.department)) m.department
      FROM public.roster_members m
     WHERE m.semester_id = p_semester_id AND m.department IS NOT NULL
     ORDER BY lower(m.department), m.department) d
  ORDER BY lower(d.department);
END;
$$;

-- ---------- Add ----------
DROP FUNCTION public.admin_add_roster_member(uuid, uuid, text, text, jsonb, text);
CREATE FUNCTION public.admin_add_roster_member(
  p_actor_id uuid, p_semester_id uuid, p_email text, p_full_name text,
  p_other_info jsonb, p_department text, p_birth_year integer, p_request_id text
) RETURNS public.roster_members
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_row public.roster_members;
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  PERFORM public.roster_lock_semester(p_semester_id);

  INSERT INTO public.roster_members
    (semester_id, user_id, email, normalized_email, full_name, other_info, department, birth_year)
  VALUES (p_semester_id,
          (SELECT u.id FROM public.app_users u WHERE u.normalized_email = lower(btrim(p_email))),
          p_email, lower(btrim(p_email)), p_full_name, coalesce(p_other_info, '{}'::jsonb),
          nullif(btrim(p_department), ''), p_birth_year)
  RETURNING * INTO v_row;   -- duplicate email in semester -> 23505; bad birth year -> 23514

  INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
  VALUES (p_actor_id, 'ROSTER_MEMBER_ADDED', 'ROSTER_MEMBER', v_row.id,
          jsonb_build_object('semester_id', p_semester_id, 'linked', v_row.user_id IS NOT NULL),
          p_request_id);
  RETURN v_row;
END;
$$;

-- ---------- Edit: p_changes may now include department and birth_year (null clears) ----------
CREATE OR REPLACE FUNCTION public.admin_update_roster_member(
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
                 WHERE k NOT IN ('full_name', 'other_info', 'department', 'birth_year',
                                 'status', 'deactivation_reason')) THEN
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
    department = CASE WHEN p_changes ? 'department' THEN nullif(btrim(p_changes->>'department'), '') ELSE department END,
    birth_year = CASE WHEN p_changes ? 'birth_year' THEN (p_changes->>'birth_year')::smallint ELSE birth_year END,
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
  IF p_changes ?| ARRAY['full_name', 'other_info', 'department', 'birth_year'] THEN
    INSERT INTO public.audit_events (actor_user_id, action, entity_type, entity_id, metadata, request_id)
    VALUES (p_actor_id, 'ROSTER_MEMBER_UPDATED', 'ROSTER_MEMBER', v_after.id,
            jsonb_build_object('semester_id', v_after.semester_id,
              'fields', (SELECT jsonb_agg(k ORDER BY k) FROM jsonb_object_keys(p_changes) k
                          WHERE k IN ('full_name', 'other_info', 'department', 'birth_year'))),
            p_request_id);
  END IF;
  RETURN v_after;
END;
$$;

-- ---------- Import preview: rows carry department and birth_year ----------
CREATE OR REPLACE FUNCTION public.roster_create_import_preview(
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
    (import_id, row_number, full_name, email, normalized_email, other_info,
     department, birth_year, status, errors)
  SELECT v_import.id, r.row_number, nullif(btrim(r.full_name), ''), nullif(btrim(r.email), ''),
         nullif(lower(btrim(r.email)), ''), coalesce(r.other_info, '{}'::jsonb),
         nullif(btrim(r.department), ''), r.birth_year,
         CASE WHEN r.status = 'VALID' AND EXISTS (
                SELECT 1 FROM public.roster_members m
                 WHERE m.semester_id = p_semester_id AND m.normalized_email = lower(btrim(r.email)))
              THEN 'UPDATE' ELSE r.status END,
         coalesce(r.errors, '[]'::jsonb)
    FROM jsonb_to_recordset(p_rows)
      AS r(row_number integer, full_name text, email text, other_info jsonb,
           department text, birth_year smallint, status text, errors jsonb);

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

-- ---------- Import commit: a blank department / birth year in the file keeps the stored value ----------
CREATE OR REPLACE FUNCTION public.roster_commit_import(
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
      (semester_id, user_id, email, normalized_email, full_name, other_info,
       department, birth_year, last_import_id)
    SELECT v_import.semester_id, u.id, r.email, r.normalized_email, r.full_name, r.other_info,
           r.department, r.birth_year, p_import_id
      FROM public.roster_import_rows r
      LEFT JOIN public.app_users u ON u.normalized_email = r.normalized_email
     WHERE r.import_id = p_import_id AND r.status IN ('VALID', 'UPDATE')
    ON CONFLICT (semester_id, normalized_email) DO UPDATE SET
      full_name      = EXCLUDED.full_name,
      other_info     = public.roster_members.other_info || EXCLUDED.other_info,
      department     = coalesce(EXCLUDED.department, public.roster_members.department),
      birth_year     = coalesce(EXCLUDED.birth_year, public.roster_members.birth_year),
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

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.admin_list_roster(uuid, text, text, boolean, text, integer, integer, integer)',
    'public.admin_list_roster_departments(uuid)',
    'public.admin_add_roster_member(uuid, uuid, text, text, jsonb, text, integer, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
