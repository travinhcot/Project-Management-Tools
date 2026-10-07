import type {
  MeetingEmailProject,
  SendStatusKey,
} from "@/features/meeting-emails/models/meeting-email";

export interface SendStatus {
  key: SendStatusKey;
  sent: number;
  /** Failed and unknown deliveries: the ones that need attention. */
  failed: number;
  total: number;
}

export function getSendStatus(project: MeetingEmailProject): SendStatus {
  const kickoff = project.kickoff;
  if (!kickoff || kickoff.state === "cancelled") {
    return {
      key: project.meetingUrl ? "ready" : "link-missing",
      sent: 0,
      failed: 0,
      total: project.memberCount,
    };
  }
  const { counts } = kickoff;
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const base = {
    sent: counts.sent,
    failed: counts.failed + counts.unknown,
    total: total || kickoff.estimatedRecipients,
  };
  switch (kickoff.state) {
    case "scheduled":
      return { key: "scheduled", ...base };
    case "processing":
      return { key: "sending", ...base };
    case "completed":
      return { key: "sent", ...base };
    case "completed_with_failures":
      return { key: base.sent === 0 ? "failed" : "partial", ...base };
  }
}

/** "meet.example.edu/open-bench" — the link without its scheme. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
