// View of the backend kick-off campaign (backend/src/modules/emails/model/email.model.ts).
import type { ProjectType } from "@/shared/models/project";

export type DeliveryState =
  | "pending"
  | "sending"
  | "sent"
  | "retrying"
  | "failed"
  | "unknown"
  | "skipped";

export type CampaignState =
  | "scheduled"
  | "processing"
  | "completed"
  | "completed_with_failures"
  | "cancelled";

export interface Delivery {
  id: string;
  recipientId: string;
  fullName: string;
  email: string;
  state: DeliveryState;
  attempts: number;
  /** ISO timestamp (UTC) of the last attempt. */
  lastAttemptAt: string | null;
  /** Sanitised provider error, only for failed deliveries. */
  error: string | null;
}

export interface Kickoff {
  id: string;
  state: CampaignState;
  /** ISO timestamp (UTC) the campaign is (or was) due to send. */
  scheduledAt: string | null;
  /** Number of deliveries per state. */
  counts: Record<DeliveryState, number>;
  /** Recipients estimated while no delivery exists yet. */
  estimatedRecipients: number;
}

export interface MeetingEmailProject {
  id: string;
  name: string;
  type: ProjectType;
  /** First-meeting link; null until an admin adds one. */
  meetingUrl: string | null;
  meetingLabel: string | null;
  /** Members assigned to the project. */
  memberCount: number;
  /** Latest kick-off campaign, null if none was ever created. */
  kickoff: Kickoff | null;
}

export type SendStatusKey =
  | "link-missing"
  | "ready"
  | "scheduled"
  | "sending"
  | "sent"
  | "partial"
  | "failed";
