-- Convert the shared admin account into the MARCOM admin. Run in the Supabase SQL editor on a dev
-- project first, after departments.schema.sql. Replace OLD_ADMIN@example.com (twice).
-- Equivalent to: node src/scripts/assign-department.ts OLD_ADMIN@example.com MARCOM

-- 1. Safety: at least one OTHER active ADMIN must remain (expect >= 1).
SELECT count(*) AS other_super_admins
  FROM public.app_users
 WHERE role = 'ADMIN' AND is_active
   AND normalized_email <> lower(btrim('OLD_ADMIN@example.com'));

-- 2. Convert (expect UPDATE 1).
UPDATE public.app_users
   SET role = 'DEPT_ADMIN',
       department_id = (SELECT id FROM public.departments WHERE code = 'MARCOM')
 WHERE normalized_email = lower(btrim('OLD_ADMIN@example.com'))
   AND role = 'ADMIN';

-- Rollback:
-- UPDATE public.app_users SET role = 'ADMIN', department_id = NULL
--  WHERE normalized_email = lower(btrim('OLD_ADMIN@example.com'));
