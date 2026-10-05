export const CAMPAIGN_KINDS = ["KICKOFF", "DEMO"] as const;
export type CampaignKind = (typeof CAMPAIGN_KINDS)[number];

export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "PROCESSING",
  "COMPLETED",
  "COMPLETED_WITH_FAILURES",
  "CANCELLED",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const DELIVERY_STATUSES = [
  "PENDING",
  "SENDING",
  "SENT",
  "FAILED_RETRYABLE",
  "FAILED_PERMANENT",
  "UNKNOWN",
  "SKIPPED",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const RESOLVE_ACTIONS = ["MARK_SENT", "RETRY"] as const;
export type ResolveAction = (typeof RESOLVE_ACTIONS)[number];

export interface Campaign {
  readonly id: string;
  readonly semester_id: string;
  readonly semester_name: string;
  readonly project_id: string | null;
  readonly project_name: string | null;
  readonly kind: CampaignKind;
  readonly status: CampaignStatus;
  readonly scheduled_at: string;
  readonly template_key: string;
  readonly template_version: number;
  readonly subject_snapshot: string | null;
  readonly demo_registration_url: string | null;
  readonly parent_campaign_id: string | null;
  readonly created_by_user_id: string;
  readonly created_at: string;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly cancelled_at: string | null;
  readonly delivery_counts: Readonly<Record<string, number>>;
  readonly estimated_recipients: number;
}

/** Row returned by the schedule/reschedule/cancel/resend functions (the bare table row). */
export interface CampaignRow {
  readonly id: string;
  readonly semester_id: string;
  readonly project_id: string | null;
  readonly kind: CampaignKind;
  readonly status: CampaignStatus;
  readonly scheduled_at: string;
  readonly parent_campaign_id: string | null;
  readonly cancelled_at: string | null;
}

export interface Delivery {
  readonly id: string;
  readonly roster_member_id: string;
  readonly full_name: string | null;
  readonly recipient_email: string;
  readonly status: DeliveryStatus;
  readonly attempt_count: number;
  readonly last_attempt_at: string | null;
  readonly sent_at: string | null;
  readonly next_attempt_at: string | null;
  readonly last_error_code: string | null;
  readonly last_error_summary: string | null;
}

export interface CampaignListQuery {
  readonly semesterId?: string;
  readonly kind?: CampaignKind;
  readonly status?: CampaignStatus;
  readonly page: number;
  readonly size: number;
}

export interface DeliveryListQuery {
  readonly status?: DeliveryStatus;
  readonly search?: string;
  readonly page: number;
  readonly size: number;
}

/** A claimed delivery with everything needed to render and send its email. */
export interface SendJob {
  readonly delivery_id: string;
  readonly campaign_id: string;
  readonly kind: CampaignKind;
  readonly template_key: string;
  readonly template_version: number;
  readonly subject: string | null;
  readonly recipient_email: string;
  readonly recipient_name: string;
  readonly project_id: string | null;
  readonly project_name: string | null;
  readonly semester_name: string;
  readonly demo_registration_url: string | null;
  readonly attempt_count: number;
}

export type DeliveryOutcome = "SENT" | "RETRYABLE" | "PERMANENT" | "UNKNOWN";

export interface ClaimedCampaign {
  readonly campaign_id: string;
  readonly recipients: number;
}

export interface ProcessSummary {
  readonly campaigns_started: number;
  readonly deliveries_attempted: number;
  readonly sent: number;
  readonly failed: number;
  readonly unknown: number;
  readonly campaigns_finalized: number;
}

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  /** Stable per delivery so a provider can drop duplicate submissions. */
  readonly idempotencyKey: string;
}

export type SendResult =
  | { readonly ok: true; readonly messageId: string }
  | {
      readonly ok: false;
      readonly outcome: Exclude<DeliveryOutcome, "SENT">;
      readonly code: string;
      readonly message: string;
    };

/** Port for the outbound mail service. Implementations must not throw for send failures. */
export interface EmailProvider {
  send(message: EmailMessage): Promise<SendResult>;
}

export interface KickoffRef {
  readonly id: string;
  readonly status: "DRAFT" | "SCHEDULED" | "PROCESSING";
  readonly scheduled_at: string;
}

/** Offered to the projects module (declared there too; the shapes match structurally). */
export interface KickoffGateway {
  findActiveKickoff(projectId: string): Promise<KickoffRef | null>;
  cancel(input: {
    campaignId: string;
    actorId: string;
    requestId: string;
  }): Promise<void>;
}

export interface EmailsOptions {
  readonly provider?: EmailProvider;
  readonly appUrl: string;
  readonly internalSecret?: string;
  readonly batchSize?: number;
}
