import type {
  MeetingEmailProject,
  SendStatusKey,
} from "@/features/meeting-emails/models/meeting-email";

export interface SendStatus {
  key: SendStatusKey;
  sent: number;
  failed: number;
  total: number;
}

export function getSendStatus(project: MeetingEmailProject): SendStatus {
  const total = project.recipients.length;
  const count = (state: string) =>
    project.deliveries.filter((delivery) => delivery.state === state).length;
  const sent = count("sent");
  const failed = count("failed");
  const base = { sent, failed, total };

  if (!project.meetingUrl) return { key: "link-missing", ...base };
  if (project.deliveries.some((d) => d.state === "sending" || d.state === "pending")) {
    return { key: "sending", ...base };
  }
  if (project.deliveries.length === 0) return { key: "ready", ...base };
  if (failed === 0) return { key: "sent", ...base };
  return { key: sent === 0 ? "failed" : "partial", ...base };
}

/** "meet.example.edu/open-bench" — the link without its scheme. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
