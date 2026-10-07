-- Research project type (Package 3). Apply after platform-tables, projects, project-status, dashboard.
-- ALTER-based: safe on a DB with data. Adds RESEARCH to projects.type and to the dashboard counts.
BEGIN;

-- The inline CHECK from platform-tables is normally named projects_type_check; look it up by
-- definition so a renamed constraint is replaced too (and the BOM/HARDWARE check is left alone).
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.projects'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%SOFTWARE%'
       AND pg_get_constraintdef(oid) NOT LIKE '%bom_external_url%'
  LOOP
    EXECUTE format('ALTER TABLE public.projects DROP CONSTRAINT %I', c.conname);
  END LOOP;
END;
$$;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_type_check CHECK (type IN ('SOFTWARE', 'HARDWARE', 'RESEARCH'));

-- Dashboard: count RESEARCH projects next to software and hardware.
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
    'projects_missing_resources', (
      SELECT jsonb_build_object('count', count(*),
               'items', coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'missing', x.missing)
                                           ORDER BY x.name) FILTER (WHERE x.rn <= p_item_limit), '[]'::jsonb))
        FROM (SELECT m.id, m.name, m.missing, row_number() OVER (ORDER BY m.name, m.id) AS rn
                FROM (SELECT p.id, p.name::text AS name,
                             ARRAY(SELECT s FROM unnest(
                                     CASE WHEN p.type = 'HARDWARE' THEN ARRAY['SRS', 'FIRST_MEETING', 'BOM']
                                          ELSE ARRAY['SRS', 'FIRST_MEETING'] END) s
                                    WHERE NOT EXISTS (SELECT 1 FROM public.project_resources r
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

COMMIT;
