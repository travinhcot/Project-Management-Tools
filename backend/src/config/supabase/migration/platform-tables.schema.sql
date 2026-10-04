
BEGIN;

CREATE TABLE public.semesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL CHECK (length(btrim(name)) > 0),
  is_active boolean NOT NULL DEFAULT false,
  demo_registration_url text CHECK (demo_registration_url IS NULL OR demo_registration_url ~ '^https://[^[:space:]]+$'),
  demo_scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX semesters_name_unique ON public.semesters (lower(btrim(name)));
CREATE UNIQUE INDEX semesters_one_active ON public.semesters ((true)) WHERE is_active;

CREATE TABLE public.roster_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL REFERENCES public.semesters(id) ON DELETE RESTRICT,
  initiated_by_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  filename text NOT NULL CHECK (length(btrim(filename)) > 0),
  file_checksum text NOT NULL CHECK (length(btrim(file_checksum)) > 0),
  status text NOT NULL CHECK (status IN ('VALIDATING', 'COMPLETED', 'FAILED')),
  total_rows integer NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  accepted_rows integer NOT NULL DEFAULT 0 CHECK (accepted_rows >= 0),
  rejected_rows integer NOT NULL DEFAULT 0 CHECK (rejected_rows >= 0),
  error_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (accepted_rows::bigint + rejected_rows::bigint <= total_rows),
  UNIQUE (semester_id, file_checksum)
);

CREATE TABLE public.roster_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL REFERENCES public.semesters(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  email varchar(320) NOT NULL CHECK (length(btrim(email)) > 0),
  normalized_email varchar(320) NOT NULL CHECK (normalized_email = lower(btrim(email))),
  full_name varchar(200) NOT NULL CHECK (length(btrim(full_name)) > 0),
  other_info jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(other_info) = 'object'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (semester_id, normalized_email),
  UNIQUE (id, semester_id)
);
CREATE UNIQUE INDEX roster_members_one_account_per_semester
  ON public.roster_members (semester_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX roster_members_user_semester ON public.roster_members (user_id, semester_id);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL REFERENCES public.semesters(id) ON DELETE RESTRICT,
  name varchar(150) NOT NULL CHECK (length(btrim(name)) > 0),
  type text NOT NULL CHECK (type IN ('SOFTWARE', 'HARDWARE')),
  kickoff_scheduled_at timestamptz,
  srs_external_url text CHECK (srs_external_url IS NULL OR srs_external_url ~ '^https://[^[:space:]]+$'),
  first_meeting_url text CHECK (first_meeting_url IS NULL OR first_meeting_url ~ '^https://[^[:space:]]+$'),
  bom_external_url text CHECK (bom_external_url IS NULL OR bom_external_url ~ '^https://[^[:space:]]+$'),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (type = 'HARDWARE' OR bom_external_url IS NULL),
  UNIQUE (id, semester_id)
);
CREATE INDEX projects_semester_archive ON public.projects (semester_id, archived_at);

CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  semester_id uuid NOT NULL,
  roster_member_id uuid NOT NULL,
  added_by_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  added_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, semester_id) REFERENCES public.projects(id, semester_id) ON DELETE RESTRICT,
  FOREIGN KEY (roster_member_id, semester_id) REFERENCES public.roster_members(id, semester_id) ON DELETE RESTRICT,
  UNIQUE (project_id, roster_member_id)
);
CREATE INDEX project_members_roster_project ON public.project_members (roster_member_id, project_id);

CREATE TABLE public.project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  category text NOT NULL CHECK (category IN ('SRS', 'CONTRIBUTION_TEMPLATE', 'BOM')),
  bucket_id text NOT NULL CHECK (length(btrim(bucket_id)) > 0),
  object_path text NOT NULL CHECK (length(btrim(object_path)) > 0),
  original_filename text NOT NULL CHECK (length(btrim(original_filename)) > 0),
  content_type varchar(255) NOT NULL CHECK (length(btrim(content_type)) > 0),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  checksum text,
  uploaded_by_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  UNIQUE (bucket_id, object_path)
);
CREATE UNIQUE INDEX project_files_one_current_slot
  ON public.project_files (project_id, category) WHERE retired_at IS NULL;

CREATE TABLE public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL REFERENCES public.semesters(id) ON DELETE RESTRICT,
  project_id uuid,
  kind text NOT NULL CHECK (kind IN ('KICKOFF', 'DEMO')),
  scheduled_at timestamptz NOT NULL,
  template_key text NOT NULL CHECK (length(btrim(template_key)) > 0),
  template_version integer NOT NULL CHECK (template_version > 0),
  status text NOT NULL CHECK (status IN ('DRAFT', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_FAILURES', 'CANCELLED')),
  idempotency_key text NOT NULL UNIQUE CHECK (length(btrim(idempotency_key)) > 0),
  created_by_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  FOREIGN KEY (project_id, semester_id) REFERENCES public.projects(id, semester_id) ON DELETE RESTRICT,
  CHECK ((kind = 'KICKOFF' AND project_id IS NOT NULL) OR (kind = 'DEMO' AND project_id IS NULL)),
  UNIQUE (id, semester_id)
);
CREATE INDEX email_campaigns_due ON public.email_campaigns (status, scheduled_at);

CREATE TABLE public.email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  semester_id uuid NOT NULL,
  roster_member_id uuid NOT NULL,
  recipient_email_snapshot varchar(320) NOT NULL CHECK (length(btrim(recipient_email_snapshot)) > 0),
  status text NOT NULL CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'FAILED_RETRYABLE', 'FAILED_PERMANENT')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  next_attempt_at timestamptz,
  provider_message_id text,
  last_error_code text,
  last_error_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (campaign_id, semester_id) REFERENCES public.email_campaigns(id, semester_id) ON DELETE RESTRICT,
  FOREIGN KEY (roster_member_id, semester_id) REFERENCES public.roster_members(id, semester_id) ON DELETE RESTRICT,
  UNIQUE (campaign_id, roster_member_id)
);
CREATE INDEX email_deliveries_retry ON public.email_deliveries (status, next_attempt_at);

CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (length(btrim(action)) > 0),
  entity_type text NOT NULL CHECK (length(btrim(entity_type)) > 0),
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  request_id text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_time ON public.audit_events (occurred_at);
CREATE INDEX audit_events_actor_time ON public.audit_events (actor_user_id, occurred_at);

CREATE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.prepare_roster_member()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE account_email text;
BEGIN
  NEW.email := btrim(NEW.email);
  NEW.normalized_email := lower(NEW.email);
  NEW.full_name := btrim(NEW.full_name);
  IF NEW.user_id IS NOT NULL THEN
    SELECT normalized_email INTO account_email FROM public.app_users WHERE id = NEW.user_id;
    IF account_email IS DISTINCT FROM NEW.normalized_email THEN
      RAISE EXCEPTION 'Roster email must match the linked application profile';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER roster_members_prepare_write BEFORE INSERT OR UPDATE ON public.roster_members
FOR EACH ROW EXECUTE FUNCTION public.prepare_roster_member();

-- Lock the project row so concurrent URL/file writes serialize for each project.
CREATE FUNCTION public.validate_project_file_slot()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE project_type text; slot_url text;
BEGIN
  SELECT type, CASE WHEN NEW.category = 'SRS' THEN srs_external_url
                   WHEN NEW.category = 'BOM' THEN bom_external_url END
    INTO project_type, slot_url FROM public.projects WHERE id = NEW.project_id FOR UPDATE;
  IF NEW.category = 'BOM' AND project_type IS DISTINCT FROM 'HARDWARE' THEN
    RAISE EXCEPTION 'BOM files require a hardware project';
  END IF;
  IF NEW.retired_at IS NULL AND slot_url IS NOT NULL THEN
    RAISE EXCEPTION 'A project slot cannot contain both a URL and an active file';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER project_files_validate_slot BEFORE INSERT OR UPDATE ON public.project_files
FOR EACH ROW EXECUTE FUNCTION public.validate_project_file_slot();

CREATE FUNCTION public.validate_project_slots()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.type <> 'HARDWARE' AND EXISTS (
    SELECT 1 FROM public.project_files WHERE project_id = NEW.id AND category = 'BOM'
  ) THEN RAISE EXCEPTION 'A project with BOM file history must remain hardware'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.project_files WHERE project_id = NEW.id AND retired_at IS NULL
      AND ((category = 'SRS' AND NEW.srs_external_url IS NOT NULL)
        OR (category = 'BOM' AND NEW.bom_external_url IS NOT NULL))
  ) THEN RAISE EXCEPTION 'A project slot cannot contain both a URL and an active file'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER projects_validate_slots BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.validate_project_slots();

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['semesters', 'roster_members', 'projects', 'email_deliveries']
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()',
      table_name || '_touch_updated_at', table_name);
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['semesters', 'roster_imports', 'roster_members', 'projects',
      'project_members', 'project_files', 'email_campaigns', 'email_deliveries', 'audit_events']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', table_name);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_roster_member() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_project_file_slot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_project_slots() FROM PUBLIC, anon, authenticated;
COMMIT;
