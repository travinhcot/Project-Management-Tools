-- FIRST_MEETING is no longer a required resource: the kick-start link is normally set once per
-- semester (semesters.kickoff_meeting_url); a project's own link is only an override.
-- Twin of backend/src/shared/resource-rules.ts. Apply after project-resources.
BEGIN;

CREATE OR REPLACE FUNCTION public.project_required_slots(p_type text)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_type
    WHEN 'HARDWARE' THEN ARRAY['SRS', 'BOM']
    WHEN 'RESEARCH' THEN ARRAY['SRS', 'RESEARCH_TEMPLATE']
    ELSE ARRAY['SRS']
  END;
$$;

COMMIT;
