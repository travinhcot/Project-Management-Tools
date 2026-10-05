import type { CampaignService } from "../service/campaign.service.ts";

import { Router } from "express";
import { adminOnly } from "../../../shared/admin-only.ts";
import { createCampaignController } from "../controller/campaign.controller.ts";

/** Mounted at /api/admin (after requireAuth + requireRole("ADMIN")). */
export function createCampaignAdminRouter(service: CampaignService) {
  const router = Router();
  const controller = createCampaignController(service);
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(adminOnly);
  router.post("/projects/:projectId/kickoff-campaign", controller.scheduleKickoff);
  router.post("/semesters/:semesterId/demo-campaign", controller.scheduleDemo);
  router.get("/campaigns", controller.list);
  router.get("/campaigns/:campaignId", controller.get);
  router.get("/campaigns/:campaignId/deliveries", controller.listDeliveries);
  router.get("/campaigns/:campaignId/preview", controller.preview);
  router.patch("/campaigns/:campaignId", controller.reschedule);
  router.post("/campaigns/:campaignId/cancel", controller.cancel);
  router.post("/campaigns/:campaignId/retry-failures", controller.retryFailures);
  router.post("/campaigns/:campaignId/resend", controller.resend);
  router.post(
    "/campaigns/:campaignId/deliveries/:deliveryId/resolve",
    controller.resolveDelivery,
  );
  return router;
}
