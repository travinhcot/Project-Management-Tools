-- Roster CSV import for a DEPT_ADMIN, limited to their own department.
-- Apply after roster-major.schema.sql and department-scope.schema.sql.
--
--   * preview: rows that name another department, or that match a roster member of another
--     department, become INVALID ("belongs to another department"). A blank department is
--     accepted; roster_members_scope_guard then gives new members the admin's department.
--   * commit: only the initiating admin may commit; "deactivate missing" only touches the admin's
--     department (the scope trigger would otherwise abort the whole commit).
--   * the missing-members count and list are limited to the department of whoever started the
--     import (ADMIN: every department).
-- The super-admin's behaviour is unchanged.
BEGIN;

CREATE OR REPLACE FUNCTION public.roster_create_import_preview(
  p_actor_id uuid, p_semester_id uuid, p_filename text, p_checksum text,
  p_rows jsonb, p_request_id text
) RETURNS public.roster_imports
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_import public.roster_imports;
  v_scope uuid;
BEGIN
  v_scope := public.assert_staff_actor(p_actor_id);  -- NULL for ADMIN
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
     department, birth_year, major, status, errors)
  SELECT v_import.id, r.row_number, nullif(btrim(r.full_name), ''), nullif(btrim(r.email), ''),
         nullif(lower(btrim(r.email)), ''), coalesce(r.other_info, '{}'::jsonb),
         nullif(btrim(r.department), ''), r.birth_year, nullif(btrim(r.major), ''),
         CASE WHEN r.status = 'VALID' AND EXISTS (
                SELECT 1 FROM public.roster_members m
                 WHERE m.semester_id = p_semester_id AND m.normalized_email = lower(btrim(r.email)))
              THEN 'UPDATE' ELSE r.status END,
         coalesce(r.errors, '[]'::jsonb)
    FROM jsonb_to_recordset(p_rows)
      AS r(row_number integer, full_name text, email text, other_info jsonb,
           department text, birth_year smallint, major text, status text, errors jsonb);

  IF v_scope IS NOT NULL THEN
    UPDATE public.roster_import_rows r SET
      status = 'INVALID',
      errors = r.errors || to_jsonb('This row belongs to another department.'::text)
     WHERE r.import_id = v_import.id AND r.status IN ('VALID', 'UPDATE')
       AND ((r.department IS NOT NULL
             AND public.department_id_from_text(r.department) IS DISTINCT FROM v_scope)
            OR EXISTS (SELECT 1 FROM public.roster_members m
                        WHERE m.semester_id = p_semester_id
                          AND m.normalized_email = r.normalized_email
                          AND m.department_id IS DISTINCT FROM v_scope));
  END IF;

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

CREATE OR REPLACE FUNCTION public.roster_commit_import(
  p_actor_id uuid, p_import_id uuid, p_deactivate_missing boolean, p_request_id text
) RETURNS public.roster_imports
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_import public.roster_imports;
  v_scope uuid;
  v_inserted integer;
  v_updated integer;
  v_deactivated integer := 0;
BEGIN
  v_scope := public.assert_staff_actor(p_actor_id);  -- NULL for ADMIN

  SELECT * INTO v_import FROM public.roster_imports WHERE id = p_import_id FOR UPDATE;
  -- A department admin only sees (and commits) the imports they started themselves.
  IF NOT FOUND OR (v_scope IS NOT NULL AND v_import.initiated_by_user_id <> p_actor_id) THEN
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
       department, birth_year, major, last_import_id)
    SELECT v_import.semester_id, u.id, r.email, r.normalized_email, r.full_name, r.other_info,
           r.department, r.birth_year, r.major, p_import_id
      FROM public.roster_import_rows r
      LEFT JOIN public.app_users u ON u.normalized_email = r.normalized_email
     WHERE r.import_id = p_import_id AND r.status IN ('VALID', 'UPDATE')
    ON CONFLICT (semester_id, normalized_email) DO UPDATE SET
      full_name      = EXCLUDED.full_name,
      other_info     = public.roster_members.other_info || EXCLUDED.other_info,
      department     = coalesce(EXCLUDED.department, public.roster_members.department),
      birth_year     = coalesce(EXCLUDED.birth_year, public.roster_members.birth_year),
      major          = coalesce(EXCLUDED.major, public.roster_members.major),
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
       AND (v_scope IS NULL OR m.department_id = v_scope)
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

-- Import summary: the missing count only covers the department of whoever started the import.
CREATE OR REPLACE FUNCTION public.admin_get_roster_import(p_import_id uuid)
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
             AND (starter.department_id IS NULL OR m.department_id = starter.department_id)
             AND NOT EXISTS (SELECT 1 FROM public.roster_import_rows r
                              WHERE r.import_id = i.id AND r.normalized_email = m.normalized_email)),
         i.deactivate_missing, i.deactivated_rows, i.expires_at, i.created_at, i.committed_at
    FROM public.roster_imports i
    LEFT JOIN public.app_users starter ON starter.id = i.initiated_by_user_id
   WHERE i.id = p_import_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'IMPORT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_import_missing(p_import_id uuid, p_limit integer, p_offset integer)
RETURNS TABLE (id uuid, email varchar, full_name varchar, user_id uuid, total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_semester uuid; v_department uuid;
BEGIN
  SELECT i.semester_id, starter.department_id INTO v_semester, v_department
    FROM public.roster_imports i
    LEFT JOIN public.app_users starter ON starter.id = i.initiated_by_user_id
   WHERE i.id = p_import_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'IMPORT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  RETURN QUERY
  SELECT m.id, m.email, m.full_name, m.user_id, count(*) OVER ()
    FROM public.roster_members m
   WHERE m.semester_id = v_semester AND m.status = 'ACTIVE'
     AND (v_department IS NULL OR m.department_id = v_department)
     AND NOT EXISTS (SELECT 1 FROM public.roster_import_rows r
                      WHERE r.import_id = p_import_id AND r.normalized_email = m.normalized_email)
   ORDER BY lower(m.full_name), m.id
   LIMIT least(greatest(p_limit, 1), 100)
  OFFSET greatest(p_offset, 0);
END;
$$;

-- Recreated functions get default PUBLIC execute; restore the service_role-only grants.
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.roster_create_import_preview(uuid, uuid, text, text, jsonb, text)',
    'public.roster_commit_import(uuid, uuid, boolean, text)',
    'public.admin_get_roster_import(uuid)',
    'public.admin_list_import_missing(uuid, integer, integer)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
