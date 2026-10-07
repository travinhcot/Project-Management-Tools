import type { Request, Response } from "express";
import type { ResourceService } from "../service/resource.service.ts";
import type { ActorLocals } from "../../../shared/request-actor.ts";

import { randomUUID } from "node:crypto";
import { requireActor } from "../../../shared/request-actor.ts";
import { linkSlotParam, projectIdParam, slotParam } from "../common/resource-params.ts";
import { linkBody } from "../dto/resource.dto.ts";

export function createResourceController(service: ResourceService) {
  return {
    async list(
      req: Request<{ projectId: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      requireActor(res.locals);
      res.json(await service.list(projectIdParam(req.params.projectId)));
    },
    async setLink(
      req: Request<{ projectId: string; slot: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      const actor = requireActor(res.locals);
      const resource = await service.setLink(
        actor.userId,
        projectIdParam(req.params.projectId),
        linkSlotParam(req.params.slot),
        linkBody(req.body),
        randomUUID(),
      );
      res.json({ resource });
    },
    async clear(
      req: Request<{ projectId: string; slot: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      const actor = requireActor(res.locals);
      await service.clear(
        actor.userId,
        projectIdParam(req.params.projectId),
        slotParam(req.params.slot),
        randomUUID(),
      );
      res.status(204).end();
    },
  };
}
