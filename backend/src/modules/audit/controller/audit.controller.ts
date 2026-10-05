import type { Request, Response } from "express";
import type { AuditService } from "../service/audit.service.ts";
import type { ActorLocals } from "../../../shared/request-actor.ts";

import { randomUUID } from "node:crypto";
import { requireActor } from "../../../shared/request-actor.ts";
import {
  eventIdParam,
  exportAuditQuery,
  listAuditQuery,
} from "../dto/audit.dto.ts";

export function createAuditController(service: AuditService) {
  return {
    async list(req: Request, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      res.json(
        await service.list(
          actor.userId,
          listAuditQuery(req.query as Record<string, unknown>),
        ),
      );
    },
    async get(
      req: Request<{ eventId: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      const actor = requireActor(res.locals);
      res.json({
        event: await service.get(
          actor.userId,
          eventIdParam(req.params.eventId),
        ),
      });
    },
    async filters(_req: Request, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      res.json(await service.filterValues(actor.userId));
    },
    async export(req: Request, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      const { csv, rows, truncated } = await service.exportCsv(
        actor.userId,
        exportAuditQuery(req.query as Record<string, unknown>),
      );
      res.set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="audit-events.csv"',
        "X-Export-Rows": String(rows),
        "X-Export-Truncated": String(truncated),
      });
      res.send(csv);
    },
  };
}

export function createAuditRetentionController(service: AuditService) {
  return {
    async purge(_req: Request, res: Response) {
      res.json(await service.purgeExpired(randomUUID()));
    },
  };
}
