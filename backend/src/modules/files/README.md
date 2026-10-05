# Files

Owns `project_resources` (one current link or file per project slot) and `project_files` (private upload metadata), the private Supabase Storage upload handlers, and authorized download.

- Slots: `SRS` (link or file), `FIRST_MEETING` (link only), `BOM` (link or file, hardware projects only).
- Upload is two-phase: register a pending row, put the object, then `finalize_file_upload` activates it and retires the previous file in one transaction. `POST /api/internal/files/cleanup` removes stale pending uploads.
- Downloads return a signed URL valid for at most 5 minutes after server-side authorization; members get a generic 404 otherwise.
- SQL: `src/config/supabase/migration/files.schema.sql`.
- Exposes `service.summarize` for the projects module's `ResourceSummaryGateway`; imports nothing from other modules.
