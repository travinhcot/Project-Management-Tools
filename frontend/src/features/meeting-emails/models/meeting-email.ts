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
  /** The project's own first-meeting link (an override); null when it uses the semester link. */
  meetingUrl: string | null;
  meetingLabel: string | null;
  /** The link the email will use: the project's own, else the semester's shared kick-start link. */
  effectiveMeetingUrl: string | null;
  /** True when the email falls back to the semester's shared link. */
  usesSharedLink: boolean;
  /** Members assigned to the project. */
  memberCount: number;
  /** Latest kick-off campaign, null if none was ever created. */
  kickoff: Kickoff | null;
}

/** The semester-wide demo-registration email (one per semester, not per project). */
export interface DemoCampaign {
  id: string;
  state: CampaignState;
  scheduledAt: string | null;
  counts: Record<DeliveryState, number>;
  estimatedRecipients: number;
}

/** Links and emails that belong to the whole semester rather than to one project. */
export interface SemesterEmails {
  semesterId: string;
  /** Shared kick-start meeting link. */
  kickoffMeetingUrl: string | null;
  demoRegistrationUrl: string | null;
  /** Latest demo campaign that was not cancelled; null when none exists. */
  demo: DemoCampaign | null;
}

export type SendStatusKey =
  | "link-missing"
  | "ready"
  | "scheduled"
  | "sending"
  | "sent"
  | "partial"
  | "failed";
