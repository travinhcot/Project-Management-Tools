import type { Request, Response } from "express";
import type { CampaignService } from "../service/campaign.service.ts";
import type { ProcessorService } from "../service/processor.service.ts";
import type { ActorLocals } from "../../../shared/request-actor.ts";

import { randomUUID } from "node:crypto";
import { requireActor } from "../../../shared/request-actor.ts";
import {
  campaignIdParam,
  deliveryIdParam,
  projectIdParam,
  semesterIdParam,
} from "../common/email-params.ts";
import {
  listCampaignsQuery,
  listDeliveriesQuery,
  resolveBody,
  scheduleBody,
} from "../dto/campaign-admin.dto.ts";

type CampaignRequest = Request<{ campaignId: string }>;

export function createCampaignController(service: CampaignService) {
  return {
    async scheduleKickoff(
      req: Request<{ projectId: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      const actor = requireActor(res.locals);
      const campaign = await service.scheduleKickoff(
        actor.userId,
        projectIdParam(req.params.projectId),
        scheduleBody(req.body).scheduledAt,
        randomUUID(),
      );
      res.status(201).json({ campaign });
    },
    async scheduleDemo(
      req: Request<{ semesterId: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      const actor = requireActor(res.locals);
      const campaign = await service.scheduleDemo(
        actor.userId,
        semesterIdParam(req.params.semesterId),
        scheduleBody(req.body).scheduledAt,
        randomUUID(),
      );
      res.status(201).json({ campaign });
    },
    async list(req: Request, res: Response<unknown, ActorLocals>) {
      requireActor(res.locals);
      res.json(
        await service.list(
          listCampaignsQuery(req.query as Record<string, unknown>),
        ),
      );
    },
    async get(req: CampaignRequest, res: Response<unknown, ActorLocals>) {
      requireActor(res.locals);
      res.json({
        campaign: await service.get(campaignIdParam(req.params.campaignId)),
      });
    },
    async listDeliveries(
      req: CampaignRequest,
      res: Response<unknown, ActorLocals>,
    ) {
      requireActor(res.locals);
      res.json(
        await service.listDeliveries(
          campaignIdParam(req.params.campaignId),
          listDeliveriesQuery(req.query as Record<string, unknown>),
        ),
      );
    },
    async preview(req: CampaignRequest, res: Response<unknown, ActorLocals>) {
      requireActor(res.locals);
      res.json({
        preview: await service.preview(campaignIdParam(req.params.campaignId)),
      });
    },
    async reschedule(
      req: CampaignRequest,
      res: Response<unknown, ActorLocals>,
    ) {
      const actor = requireActor(res.locals);
      const campaign = await service.reschedule(
        actor.userId,
        campaignIdParam(req.params.campaignId),
        scheduleBody(req.body).scheduledAt,
        randomUUID(),
      );
      res.json({ campaign });
    },
    async cancel(req: CampaignRequest, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      const campaign = await service.cancel(
        actor.userId,
        campaignIdParam(req.params.campaignId),
        randomUUID(),
      );
      res.json({ campaign });
    },
    async retryFailures(
      req: CampaignRequest,
      res: Response<unknown, ActorLocals>,
    ) {
      const actor = requireActor(res.locals);
      const requeued = await service.retryFailures(
        actor.userId,
        campaignIdParam(req.params.campaignId),
        randomUUID(),
      );
      res.json({ requeued });
    },
    async resend(req: CampaignRequest, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      const campaign = await service.resend(
        actor.userId,
        campaignIdParam(req.params.campaignId),
        randomUUID(),
      );
      res.status(201).json({ campaign });
    },
    async resolveDelivery(
      req: Request<{ campaignId: string; deliveryId: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      const actor = requireActor(res.locals);
      const status = await service.resolveDelivery(
        actor.userId,
        campaignIdParam(req.params.campaignId),
        deliveryIdParam(req.params.deliveryId),
        resolveBody(req.body).action,
        randomUUID(),
      );
      res.json({ campaign_status: status });
    },
  };
}

export function createProcessorController(processor: ProcessorService) {
  return {
    async process(_req: Request, res: Response) {
      res.json(await processor.processDue());
    },
  };
}
