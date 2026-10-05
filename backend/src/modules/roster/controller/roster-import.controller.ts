import type { Request, Response } from "express";
import type { RosterImportService } from "../service/roster-import.service.ts";
import type { ActorLocals } from "../../../shared/request-actor.ts";

import { randomUUID } from "node:crypto";
import { HttpError } from "../../../shared/http-error.ts";
import { requireActor } from "../../../shared/request-actor.ts";
import { importIdParam, semesterIdParam } from "../common/import-params.ts";
import {
  commitBody,
  historyQuery,
  missingQuery,
  rowsQuery,
  uploadFilename,
} from "../dto/roster-import.dto.ts";

export function createRosterImportController(service: RosterImportService) {
  return {
    async upload(
      req: Request<{ semesterId: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      const actor = requireActor(res.locals);
      const semesterId = semesterIdParam(req.params.semesterId);
      const filename = uploadFilename(req.query as Record<string, unknown>);
      if (!Buffer.isBuffer(req.body)) {
        throw new HttpError(
          415,
          "UNSUPPORTED_MEDIA_TYPE",
          "Send the file as text/csv.",
        );
      }
      if (req.body.length === 0)
        throw new HttpError(400, "INVALID_CSV", "The file is empty.");
      const result = await service.createPreview({
        actorId: actor.userId,
        semesterId,
        filename,
        bytes: req.body,
        requestId: randomUUID(),
      });
      res.status(201).json(result);
    },
    async history(
      req: Request<{ semesterId: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      requireActor(res.locals);
      res.json(
        await service.history(
          semesterIdParam(req.params.semesterId),
          historyQuery(req.query as Record<string, unknown>),
        ),
      );
    },
    async get(
      req: Request<{ importId: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      requireActor(res.locals);
      res.json({
        import: await service.getSummary(importIdParam(req.params.importId)),
      });
    },
    async rows(
      req: Request<{ importId: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      requireActor(res.locals);
      const { status, page, size } = rowsQuery(
        req.query as Record<string, unknown>,
      );
      res.json(
        await service.rows(importIdParam(req.params.importId), status, {
          page,
          size,
        }),
      );
    },
    async missing(
      req: Request<{ importId: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      requireActor(res.locals);
      res.json(
        await service.missing(
          importIdParam(req.params.importId),
          missingQuery(req.query as Record<string, unknown>),
        ),
      );
    },
    async commit(
      req: Request<{ importId: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      const actor = requireActor(res.locals);
      const { deactivate_missing } = commitBody(req.body);
      const summary = await service.commit(
        actor.userId,
        importIdParam(req.params.importId),
        deactivate_missing,
        randomUUID(),
      );
      res.json({ import: summary });
    },
  };
}
