-- Admin dashboard (FR-DSH-01). Apply after audit.schema.sql (needs assert_admin_actor and every
-- table below). Owner: dashboard. Read-only functions that aggregate semesters, roster_members,
-- projects, project_members, project_resources, email_campaigns, email_deliveries and
-- roster_imports by SQL (same precedent as portal.schema.sql). One call per screen: no N+1.
-- Callable by the backend (service_role) only.
BEGIN;

-- Summary + warnings for the current semester. Slots a project must fill mirror
-- files/model/resource.model.ts#requiredSlots: SRS and FIRST_MEETING, plus BOM for HARDWARE.
CREATE FUNCTION public.admin_dashboard_summary(p_actor_id uuid, p_item_limit integer DEFAULT 10)
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
                    WHERE semester_id = v_sem.id AND archived_at IS NULL AND type = 'HARDWARE')),
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

-- Per-semester series (latest p_limit semesters, newest first) for charts and engagement metrics.
CREATE FUNCTION public.admin_dashboard_trends(p_actor_id uuid, p_limit integer)
RETURNS TABLE (
  semester_id uuid, semester_name text, is_current boolean,
  roster_total bigint, roster_active bigint, accounts_linked bigint, members_assigned bigint,
  projects bigint, campaigns bigint,
  deliveries_total bigint, deliveries_sent bigint, deliveries_failed bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_admin_actor(p_actor_id);
  RETURN QUERY
  WITH recent AS (
    SELECT s.id, s.name::text AS name, s.is_current, s.year, s.term
      FROM public.semesters s ORDER BY s.year DESC, s.term DESC LIMIT p_limit
  ), roster AS (
    SELECT rm.semester_id,
           count(*) AS total,
           count(*) FILTER (WHERE rm.status = 'ACTIVE') AS active,
           count(*) FILTER (WHERE rm.status = 'ACTIVE' AND rm.user_id IS NOT NULL) AS linked,
           count(*) FILTER (WHERE rm.status = 'ACTIVE' AND EXISTS (
             SELECT 1 FROM public.project_members pm
              WHERE pm.roster_member_id = rm.id AND pm.removed_at IS NULL)) AS assigned
      FROM public.roster_members rm JOIN recent r ON r.id = rm.semester_id GROUP BY rm.semester_id
  ), proj AS (
    SELECT p.semester_id, count(*) AS n
      FROM public.projects p JOIN recent r ON r.id = p.semester_id
     WHERE p.archived_at IS NULL GROUP BY p.semester_id
  ), camp AS (
    SELECT c.semester_id, count(*) AS n
      FROM public.email_campaigns c JOIN recent r ON r.id = c.semester_id
     WHERE c.status <> 'CANCELLED' GROUP BY c.semester_id
  ), deliv AS (
    SELECT d.semester_id, count(*) AS total,
           count(*) FILTER (WHERE d.status = 'SENT') AS sent,
           count(*) FILTER (WHERE d.status IN ('FAILED_RETRYABLE', 'FAILED_PERMANENT')) AS failed
      FROM public.email_deliveries d JOIN recent r ON r.id = d.semester_id GROUP BY d.semester_id
  )
  SELECT r.id, r.name, r.is_current,
         coalesce(ro.total, 0), coalesce(ro.active, 0), coalesce(ro.linked, 0), coalesce(ro.assigned, 0),
         coalesce(pr.n, 0), coalesce(ca.n, 0),
         coalesce(de.total, 0), coalesce(de.sent, 0), coalesce(de.failed, 0)
    FROM recent r
    LEFT JOIN roster ro ON ro.semester_id = r.id
    LEFT JOIN proj pr ON pr.semester_id = r.id
    LEFT JOIN camp ca ON ca.semester_id = r.id
    LEFT JOIN deliv de ON de.semester_id = r.id
   ORDER BY r.year DESC, r.term DESC;
END;
$$;

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.admin_dashboard_summary(uuid, integer)',
    'public.admin_dashboard_trends(uuid, integer)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
