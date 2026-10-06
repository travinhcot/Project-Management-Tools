// Simplified view of the backend kick-off campaign (backend/src/modules/emails/model/email.model.ts):
// DeliveryStatus SENT / FAILED_* / PENDING / SENDING collapse to the four states below.
import type { ProjectType } from "@/shared/models/project";

export type DeliveryState = "pending" | "sending" | "sent" | "failed";

export interface Recipient {
  id: string;
  fullName: string;
  email: string;
}

export interface Delivery {
  recipientId: string;
  state: DeliveryState;
  attempts: number;
  /** ISO timestamp (UTC) of the last attempt. */
  lastAttemptAt: string | null;
  /** Sanitised provider error, only for failed deliveries. */
  error: string | null;
}

export interface MeetingEmailProject {
  id: string;
  name: string;
  type: ProjectType;
  /** First-meeting link; null until an admin adds one. */
  meetingUrl: string | null;
  meetingLabel: string | null;
  /** Active roster members with an active assignment, resolved at send time. */
  recipients: Recipient[];
  /** Empty until the email has been sent at least once. */
  deliveries: Delivery[];
  /** ISO timestamp (UTC) of the most recent send. */
  lastSentAt: string | null;
}

export type SendStatusKey =
  | "link-missing"
  | "ready"
  | "sending"
  | "sent"
  | "partial"
  | "failed";
