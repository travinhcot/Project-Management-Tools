-- Member department. Apply after departments.schema.sql and portal.schema.sql.
-- The department code of the actor's ACTIVE roster entry in the current semester, the same
-- source department_resource_scope uses for a member. NULL when there is no such entry or the
-- roster entry has no department. Read-only; the member portal uses it to pick the dashboard.
BEGIN;

CREATE FUNCTION public.member_department(p_actor_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT d.code::text
    FROM public.member_eligibility(p_actor_id) e
    JOIN public.roster_members rm ON rm.id = e.roster_member_id
    JOIN public.departments d ON d.id = rm.department_id;
$$;

REVOKE ALL ON FUNCTION public.member_department(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_department(uuid) TO service_role;

COMMIT;
