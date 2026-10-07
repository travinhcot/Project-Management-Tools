// Reads kick-off campaigns from the backend (GET /api/admin/projects, /campaigns, /deliveries,
// /preview). Server-only: it goes through backendFetch, which attaches the admin session token.
import { backendFetch } from "@/shared/api/backend";
import { ApiError } from "@/shared/api/errors";
import type { ProjectType } from "@/shared/models/project";
import type {
  CampaignState,
  DemoCampaign,
  Delivery,
  DeliveryState,
  Kickoff,
  MeetingEmailProject,
  ProjectResourcesCampaign,
  SemesterEmails,
} from "@/features/meeting-emails/models/meeting-email";
import type { SemesterSummary } from "@/features/projects/models/project";
import {
  mapSemester,
  type ProjectDto,
} from "@/features/projects/service/projects.service";
import { getSemesters } from "@/features/semesters/service/semesters.service";

const PROJECT_LIMIT = 100;

/** Campaign in backend/src/modules/emails/model/email.model.ts. */
interface CampaignDto {
  id: string;
  project_id: string | null;
  status: string;
  scheduled_at: string;
  delivery_counts: Record<string, number>;
  estimated_recipients: number;
}

/** Delivery in backend/src/modules/emails/model/email.model.ts. */
interface DeliveryDto {
  id: string;
  roster_member_id: string;
  full_name: string;
  recipient_email: string;
  status: string;
  attempt_count: number;
  last_attempt_at: string | null;
  last_error_summary: string | null;
}

const CAMPAIGN_STATES: Record<string, CampaignState> = {
  DRAFT: "scheduled",
  SCHEDULED: "scheduled",
  PROCESSING: "processing",
  COMPLETED: "completed",
  COMPLETED_WITH_FAILURES: "completed_with_failures",
  CANCELLED: "cancelled",
};

const DELIVERY_STATES: Record<string, DeliveryState> = {
  PENDING: "pending",
  SENDING: "sending",
  SENT: "sent",
  FAILED_RETRYABLE: "retrying",
  FAILED_PERMANENT: "failed",
  UNKNOWN: "unknown",
  SKIPPED: "skipped",
};

const emptyCounts = (): Record<DeliveryState, number> => ({
  pending: 0,
  sending: 0,
  sent: 0,
  retrying: 0,
  failed: 0,
  unknown: 0,
  skipped: 0,
});

function mapKickoff(
  summary: NonNullable<ProjectDto["kickoff"]>,
  campaign: CampaignDto | undefined,
): Kickoff {
  const counts = emptyCounts();
  for (const [status, count] of Object.entries(campaign?.delivery_counts ?? {})) {
    const state = DELIVERY_STATES[status];
    if (state) counts[state] += count;
  }
  return {
    id: summary.id,
    state: CAMPAIGN_STATES[summary.status] ?? "scheduled",
    scheduledAt: summary.scheduled_at,
    counts,
    estimatedRecipients: campaign?.estimated_recipients ?? 0,
  };
}

function mapDemo(campaign: CampaignDto): DemoCampaign {
  const counts = emptyCounts();
  for (const [status, count] of Object.entries(campaign.delivery_counts ?? {})) {
    const state = DELIVERY_STATES[status];
    if (state) counts[state] += count;
  }
  return {
    id: campaign.id,
    state: CAMPAIGN_STATES[campaign.status] ?? "scheduled",
    scheduledAt: campaign.scheduled_at,
    counts,
    estimatedRecipients: campaign.estimated_recipients,
  };
}

export function mapDelivery(dto: DeliveryDto): Delivery {
  return {
    id: dto.id,
    recipientId: dto.roster_member_id,
    fullName: dto.full_name,
    email: dto.recipient_email,
    state: DELIVERY_STATES[dto.status] ?? "pending",
    attempts: dto.attempt_count,
    lastAttemptAt: dto.last_attempt_at,
    error: dto.last_error_summary,
  };
}

/** The project's first-meeting link; a missing resource list simply means "no link". */
async function fetchMeetingLink(
  projectId: string,
): Promise<{ url: string | null; label: string | null }> {
  try {
    const { resources } = await backendFetch<{
      resources: { slot: string; url: string | null; label: string | null }[];
    }>(`/api/admin/projects/${projectId}/resources`);
    const meeting = resources.find((resource) => resource.slot === "FIRST_MEETING");
    return { url: meeting?.url ?? null, label: meeting?.label ?? null };
  } catch (error) {
    if (error instanceof ApiError) return { url: null, label: null };
    throw error;
  }
}

export async function getMeetingEmails(semesterId?: string): Promise<{
  semester: SemesterSummary | null;
  projects: MeetingEmailProject[];
  links: SemesterEmails | null;
}> {
  const data = await backendFetch<{
    semester: { id: string; name: string; is_current: boolean } | null;
    items: ProjectDto[];
  }>(
    `/api/admin/projects?size=${PROJECT_LIMIT}${semesterId ? `&semesterId=${encodeURIComponent(semesterId)}` : ""}`,
  );
  if (!data.semester) return { semester: null, projects: [], links: null };

  const params = new URLSearchParams({
    kind: "KICKOFF",
    semesterId: data.semester.id,
    size: String(PROJECT_LIMIT),
  });
  const demoParams = new URLSearchParams({
    kind: "DEMO",
    semesterId: data.semester.id,
    size: "20",
  });
  const resourcesParams = new URLSearchParams({
    kind: "PROJECT_RESOURCES",
    semesterId: data.semester.id,
    size: String(PROJECT_LIMIT),
  });
  const [campaigns, links, demoCampaigns, resourceCampaigns, { semesters }] = await Promise.all([
    backendFetch<{ items: CampaignDto[] }>(`/api/admin/campaigns?${params}`),
    Promise.all(data.items.map((project) => fetchMeetingLink(project.id))),
    backendFetch<{ items: CampaignDto[] }>(`/api/admin/campaigns?${demoParams}`),
    backendFetch<{ items: CampaignDto[] }>(`/api/admin/campaigns?${resourcesParams}`),
    getSemesters(),
  ]);
  const semesterLinks = semesters.find((row) => row.id === data.semester!.id);
  const sharedUrl = semesterLinks?.kickoffMeetingUrl ?? null;
  // Newest first; a cancelled demo email is as good as none.
  const demo = demoCampaigns.items.find((campaign) => campaign.status !== "CANCELLED");
  // Newest first: keep one non-cancelled follow-up per project.
  const projectResources: ProjectResourcesCampaign[] = [];
  for (const campaign of resourceCampaigns.items) {
    if (campaign.status === "CANCELLED" || !campaign.project_id) continue;
    if (projectResources.some((item) => item.projectId === campaign.project_id)) continue;
    projectResources.push({
      id: campaign.id,
      projectId: campaign.project_id,
      state: CAMPAIGN_STATES[campaign.status] ?? "scheduled",
      scheduledAt: campaign.scheduled_at,
    });
  }
  const campaignById = new Map(campaigns.items.map((campaign) => [campaign.id, campaign]));

  return {
    semester: mapSemester(data.semester),
    projects: data.items.map((project, index) => ({
      id: project.id,
      name: project.name,
      type: project.type.toLowerCase() as ProjectType,
      meetingUrl: links[index].url,
      meetingLabel: links[index].label,
      effectiveMeetingUrl: links[index].url ?? sharedUrl,
      usesSharedLink: !links[index].url && Boolean(sharedUrl),
      memberCount: project.member_count,
      kickoff: project.kickoff
        ? mapKickoff(project.kickoff, campaignById.get(project.kickoff.id))
        : null,
    })),
    links: {
      semesterId: data.semester.id,
      kickoffMeetingUrl: sharedUrl,
      demoRegistrationUrl: semesterLinks?.demoRegistrationUrl ?? null,
      demo: demo ? mapDemo(demo) : null,
      projectResources,
    },
  };
}

export async function fetchDeliveries(campaignId: string): Promise<Delivery[]> {
  const { items } = await backendFetch<{ items: DeliveryDto[] }>(
    `/api/admin/campaigns/${campaignId}/deliveries?size=100`,
  );
  return items.map(mapDelivery);
}

export interface EmailPreviewData {
  subject: string;
  text: string;
}

export async function fetchPreview(campaignId: string): Promise<EmailPreviewData> {
  const { preview } = await backendFetch<{ preview: EmailPreviewData }>(
    `/api/admin/campaigns/${campaignId}/preview`,
  );
  return { subject: preview.subject, text: preview.text };
}
