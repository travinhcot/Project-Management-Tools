"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/shared/components/Button";
import { Drawer } from "@/shared/components/Drawer";
import type { SemesterEmails } from "@/features/meeting-emails/models/meeting-email";
import type { SemesterSummary } from "@/features/projects/models/project";
import { validateHttpsUrl } from "@/features/projects/utils/validation";

const inputClass =
  "h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

/** The one place to set the semester's two links: kick-start meeting and demo registration. */
export function SemesterLinksDrawer({
  semester,
  links,
  busy,
  error,
  onClose,
  onSave,
}: {
  semester: SemesterSummary;
  links: SemesterEmails;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSave: (links: { kickoffMeetingUrl: string | null; demoRegistrationUrl: string | null }) => void;
}) {
  const [kickoff, setKickoff] = useState(links.kickoffMeetingUrl ?? "");
  const [demo, setDemo] = useState(links.demoRegistrationUrl ?? "");
  const [errors, setErrors] = useState<{ kickoff?: string; demo?: string }>({});

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // A blank field clears that link; anything typed must be a valid https link.
    const next = {
      kickoff: kickoff.trim() ? validateHttpsUrl(kickoff) : undefined,
      demo: demo.trim() ? validateHttpsUrl(demo) : undefined,
    };
    setErrors(next);
    if (next.kickoff || next.demo) return;
    onSave({
      kickoffMeetingUrl: kickoff.trim() || null,
      demoRegistrationUrl: demo.trim() || null,
    });
  }

  return (
    <Drawer title="Semester links" subtitle={semester.label} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
          Kick-start meeting link
          <input
            type="url"
            value={kickoff}
            onChange={(event) => setKickoff(event.target.value)}
            placeholder="https://meet.example.edu/kick-start"
            aria-invalid={Boolean(errors.kickoff)}
            className={inputClass}
          />
          {errors.kickoff && (
            <span role="alert" className="text-xs font-medium text-danger">
              {errors.kickoff}
            </span>
          )}
          <span className="text-xs font-normal text-muted">
            One link shared by every project. A project can still set its own link to override it.
          </span>
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
          Demo registration link
          <input
            type="url"
            value={demo}
            onChange={(event) => setDemo(event.target.value)}
            placeholder="https://forms.example.edu/demo"
            aria-invalid={Boolean(errors.demo)}
            className={inputClass}
          />
          {errors.demo && (
            <span role="alert" className="text-xs font-medium text-danger">
              {errors.demo}
            </span>
          )}
          <span className="text-xs font-normal text-muted">
            Sent to everyone on the roster near the end of the semester.
          </span>
        </label>

        <p className="rounded-[10px] bg-accent-soft p-3 text-xs text-info-text">
          Leave a field empty to remove that link. Send dates are set separately on the page.
        </p>
        {error && (
          <p role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Save links
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
