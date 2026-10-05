import type { Request, Response } from "express";
import type { DashboardService } from "../service/dashboard.service.ts";
import type { ActorLocals } from "../../../shared/request-actor.ts";

import {
  invalid,
  positiveInt,
  rejectUnknownKeys,
  single,
} from "../../../shared/query-params.ts";
import { requireActor } from "../../../shared/request-actor.ts";
import {
  DEFAULT_TREND_SEMESTERS,
  MAX_TREND_SEMESTERS,
} from "../model/dashboard.model.ts";

export function createDashboardController(service: DashboardService) {
  return {
    async summary(_req: Request, res: Response<unknown, ActorLocals>) {
      res.json(await service.summary(requireActor(res.locals).userId));
    },
    async trends(req: Request, res: Response<unknown, ActorLocals>) {
      const query = req.query as Record<string, unknown>;
      rejectUnknownKeys(query, ["semesters"], "The request contains invalid query parameters.");
      const semesters = positiveInt(
        single(query, "semesters"),
        DEFAULT_TREND_SEMESTERS,
        MAX_TREND_SEMESTERS,
        "semesters",
      );
      if (semesters < 1) invalid("semesters must be at least 1.");
      res.json({
        semesters: await service.trends(requireActor(res.locals).userId, semesters),
      });
    },
  };
}
