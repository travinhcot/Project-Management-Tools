import type { EmailRepository } from "../repository/email.repository.ts";
import type {
  Campaign,
  CampaignListQuery,
  CampaignRow,
  Delivery,
  DeliveryListQuery,
  KickoffGateway,
  ResolveAction,
} from "../model/email.model.ts";
import type { Page } from "../../../shared/pagination.ts";
import type { RenderedEmail } from "../template/render.ts";

import { HttpError } from "../../../shared/http-error.ts";
import { emailError } from "../common/email-errors.ts";
import { buildContext } from "../template/context.ts";
import { renderEmail } from "../template/render-email.ts";

const NOT_FOUND = new HttpError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found.");

async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw emailError(error);
  }
}

export function createCampaignService(
  repository: EmailRepository,
  options: { appUrl: string },
) {
  async function requireCampaign(campaignId: string): Promise<Campaign> {
    const campaign = await guarded(() => repository.findCampaign(campaignId));
    if (!campaign) throw NOT_FOUND;
    return campaign;
  }

  return {
    async list(query: CampaignListQuery): Promise<Page<Campaign>> {
      const { rows, total } = await guarded(() =>
        repository.listCampaigns(query),
      );
      return { items: rows, page: query.page, size: query.size, total };
    },

    get: requireCampaign,

    async listDeliveries(
      campaignId: string,
      query: DeliveryListQuery,
    ): Promise<Page<Delivery>> {
      await requireCampaign(campaignId);
      const { rows, total } = await guarded(() =>
        repository.listDeliveries(campaignId, query),
      );
      return { items: rows, page: query.page, size: query.size, total };
    },

    /** Renders the campaign's template with a sample recipient (admin preview). */
    async preview(campaignId: string): Promise<RenderedEmail> {
      const campaign = await requireCampaign(campaignId);
      return renderEmail(
        campaign.kind,
        buildContext(
          {
            subject: campaign.subject_snapshot,
            recipientName: "Member",
            projectId: campaign.project_id,
            projectName: campaign.project_name,
            semesterName: campaign.semester_name,
            demoUrl: campaign.demo_registration_url,
          },
          options.appUrl,
        ),
      );
    },

    scheduleKickoff(
      actorId: string,
      projectId: string,
      scheduledAt: string,
      requestId: string,
    ): Promise<CampaignRow> {
      return guarded(() =>
        repository.scheduleKickoff({ actorId, projectId, scheduledAt, requestId }),
      );
    },

    scheduleDemo(
      actorId: string,
      semesterId: string,
      scheduledAt: string,
      requestId: string,
    ): Promise<CampaignRow> {
      return guarded(() =>
        repository.scheduleDemo({ actorId, semesterId, scheduledAt, requestId }),
      );
    },

    reschedule(
      actorId: string,
      campaignId: string,
      scheduledAt: string,
      requestId: string,
    ): Promise<CampaignRow> {
      return guarded(() =>
        repository.reschedule({ actorId, campaignId, scheduledAt, requestId }),
      );
    },

    cancel(
      actorId: string,
      campaignId: string,
      requestId: string,
    ): Promise<CampaignRow> {
      return guarded(() =>
        repository.cancel({ actorId, campaignId, requestId }),
      );
    },

    resend(
      actorId: string,
      campaignId: string,
      requestId: string,
    ): Promise<CampaignRow> {
      return guarded(() =>
        repository.resend({ actorId, campaignId, requestId }),
      );
    },

    retryFailures(
      actorId: string,
      campaignId: string,
      requestId: string,
    ): Promise<number> {
      return guarded(() =>
        repository.retryFailures({ actorId, campaignId, requestId }),
      );
    },

    resolveDelivery(
      actorId: string,
      campaignId: string,
      deliveryId: string,
      action: ResolveAction,
      requestId: string,
    ): Promise<string> {
      return guarded(() =>
        repository.resolveDelivery({
          actorId,
          campaignId,
          deliveryId,
          action,
          requestId,
        }),
      );
    },

    /** The slice the projects module consumes when archiving a project. */
    kickoffs: {
      findActiveKickoff: (projectId: string) =>
        guarded(() => repository.findActiveKickoff(projectId)),
      async cancel(input: {
        campaignId: string;
        actorId: string;
        requestId: string;
      }): Promise<void> {
        await guarded(() => repository.cancel(input));
      },
    } satisfies KickoffGateway,
  };
}

export type CampaignService = ReturnType<typeof createCampaignService>;
