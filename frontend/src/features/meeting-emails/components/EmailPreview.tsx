"use client";

import { useEffect, useState } from "react";
import { getPreview } from "@/features/meeting-emails/actions";
import type { MeetingEmailProject } from "@/features/meeting-emails/models/meeting-email";
import type { EmailPreviewData } from "@/features/meeting-emails/service/meeting-emails.service";

/**
 * The real rendered kick-off email (GET /campaigns/:id/preview). The backend can only render a
 * preview once a campaign exists, so before the first send we explain that instead of guessing.
 */
export function EmailPreview({ project }: { project: MeetingEmailProject }) {
  const campaignId =
    project.kickoff && project.kickoff.state !== "cancelled" ? project.kickoff.id : null;
  const meetingUrl = project.effectiveMeetingUrl;
  const [loaded, setLoaded] = useState<{
    key: string;
    preview: EmailPreviewData | null;
    error: string | null;
  } | null>(null);
  // The preview depends on the campaign and on the meeting link the email embeds.
  const key = `${campaignId}|${meetingUrl}`;

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    getPreview(campaignId).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok
          ? { key, preview: result.preview, error: null }
          : { key, preview: null, error: result.message },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [campaignId, key]);

  const current = campaignId && loaded?.key === key ? loaded : null;

  return (
    <aside
      aria-label="Email preview"
      className="flex flex-col gap-[15px] rounded-2xl bg-surface shadow-card p-[22px]"
    >
      <h2 className="text-[19px] font-semibold text-ink">Email preview</h2>
      <p className="text-xs text-muted">The message prepared for {project.name}.</p>

      {!campaignId ? (
        <p className="rounded-lg bg-chrome p-3 text-xs text-muted">
          {project.effectiveMeetingUrl
            ? "The preview appears once the email is sent or scheduled. It will include the first meeting link and a link to the project page."
            : "Add a meeting link first. The email includes it along with a link to the project page."}
        </p>
      ) : current?.error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {current.error}
        </p>
      ) : !current?.preview ? (
        <div className="h-24 animate-pulse rounded-lg bg-chrome" aria-busy="true" />
      ) : (
        <>
          <div className="flex flex-col gap-[9px] rounded-lg bg-chrome p-[13px] text-xs">
            <p className="whitespace-pre font-medium text-muted">
              {`To  ${project.memberCount} assigned ${project.memberCount === 1 ? "member" : "members"}`}
            </p>
            <p className="break-words font-semibold text-ink">
              Subject  {current.preview.subject}
            </p>
          </div>
          <p className="text-[10px] font-bold text-muted">MESSAGE</p>
          <p className="whitespace-pre-wrap break-words text-[13px] text-ink">
            {current.preview.text}
          </p>
        </>
      )}
    </aside>
  );
}
