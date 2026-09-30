BEGIN;

CREATE TABLE public.app_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  email varchar(320) NOT NULL,
  normalized_email varchar(320) NOT NULL UNIQUE,
  full_name varchar(200) NOT NULL,
  role text NOT NULL DEFAULT 'MEMBER'
    CHECK (role IN ('ADMIN', 'MEMBER')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_users_email_not_blank CHECK (length(btrim(email)) > 0),
  CONSTRAINT app_users_name_not_blank CHECK (length(btrim(full_name)) > 0),
  CONSTRAINT app_users_email_normalized
    CHECK (normalized_email = lower(btrim(email)))
);

-- Enforce verified identity linkage even on trusted server writes. Role and
-- active state are intentionally independent of user-editable Auth metadata.
CREATE FUNCTION public.prepare_app_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  identity_email text;
  verified_at timestamptz;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'An application profile identity cannot be changed';
  END IF;

  SELECT email, email_confirmed_at INTO identity_email, verified_at
    FROM auth.users WHERE id = NEW.id;

  IF identity_email IS NULL OR verified_at IS NULL THEN
    RAISE EXCEPTION 'Application profiles require a verified Auth email';
  END IF;

  NEW.email := btrim(NEW.email);
  NEW.normalized_email := lower(NEW.email);
  NEW.full_name := btrim(NEW.full_name);

  IF NEW.normalized_email IS DISTINCT FROM lower(btrim(identity_email)) THEN
    RAISE EXCEPTION 'Profile email must match the verified Auth identity';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.created_at := OLD.created_at;
  ELSE
    NEW.created_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_users_prepare_write
BEFORE INSERT OR UPDATE ON public.app_users
FOR EACH ROW EXECUTE FUNCTION public.prepare_app_user();

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Browser clients can only read their own active profile. All writes, including
-- bootstrap ADMIN provisioning, go through a trusted backend connection.
REVOKE ALL ON TABLE public.app_users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.app_users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.app_users TO service_role;

CREATE POLICY app_users_read_own_active_profile
ON public.app_users FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()) AND is_active);

REVOKE ALL ON FUNCTION public.prepare_app_user() FROM PUBLIC, anon, authenticated;

COMMIT;
