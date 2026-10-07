import type { Request, Response } from "express";
import type { PortalService } from "../service/portal.service.ts";
import type { ActorLocals } from "../../../shared/request-actor.ts";

import { invalid, single, uuidParam } from "../../../shared/query-params.ts";
import { requireActor } from "../../../shared/request-actor.ts";

export function createPortalController(service: PortalService) {
  return {
    async status(_req: Request, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      const { eligible, email, full_name } = await service.status(actor.userId);
      res.json({ role: actor.role, eligible, email, full_name });
    },
    async overview(_req: Request, res: Response<unknown, ActorLocals>) {
      res.json(await service.overview(requireActor(res.locals).userId));
    },
    async profile(_req: Request, res: Response<unknown, ActorLocals>) {
      res.json(await service.profile(requireActor(res.locals).userId));
    },
    async listProjects(req: Request, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      const include = single(req.query, "include");
      if (include !== undefined && include !== "past")
        invalid('include must be "past".');
      res.json(
        await service.listProjects(actor.userId, {
          includePast: include === "past",
        }),
      );
    },
    async getProject(
      req: Request<{ projectId: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      const actor = requireActor(res.locals);
      res.json({
        project: await service.getProject(
          actor.userId,
          uuidParam(req.params.projectId, "project id"),
        ),
      });
    },
    async badge(_req: Request, res: Response<unknown, ActorLocals>) {
      res.json(await service.badge(requireActor(res.locals).userId));
    },
  };
}
