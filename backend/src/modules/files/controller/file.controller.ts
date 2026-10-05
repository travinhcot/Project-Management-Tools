import type { Request, Response } from "express";
import type { FileService } from "../service/file.service.ts";
import type { ActorLocals } from "../../../shared/request-actor.ts";

import { randomUUID } from "node:crypto";
import { HttpError } from "../../../shared/http-error.ts";
import { requireActor } from "../../../shared/request-actor.ts";
import {
  fileIdParam,
  fileSlotParam,
  projectIdParam,
} from "../common/resource-params.ts";
import { uploadFilename } from "../dto/resource.dto.ts";

export function createFileController(service: FileService) {
  return {
    async upload(
      req: Request<{ projectId: string; slot: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      const actor = requireActor(res.locals);
      const projectId = projectIdParam(req.params.projectId);
      const slot = fileSlotParam(req.params.slot);
      const filename = uploadFilename(req);
      if (!Buffer.isBuffer(req.body)) {
        throw new HttpError(
          415,
          "UNSUPPORTED_MEDIA_TYPE",
          "Send the file as the raw request body with its own Content-Type.",
        );
      }
      const file = await service.upload({
        actorId: actor.userId,
        projectId,
        slot,
        filename,
        declaredType: (req.get("content-type") ?? "").split(";")[0].trim().toLowerCase(),
        bytes: req.body,
        requestId: randomUUID(),
      });
      res.status(201).json({ file });
    },
    async adminDownload(
      req: Request<{ projectId: string; fileId: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      const actor = requireActor(res.locals);
      res.json(
        await service.adminDownload(
          actor.userId,
          projectIdParam(req.params.projectId),
          fileIdParam(req.params.fileId),
        ),
      );
    },
    async memberDownload(
      req: Request<{ projectId: string; fileId: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      const actor = requireActor(res.locals);
      res.json(
        await service.memberDownload(
          actor.userId,
          projectIdParam(req.params.projectId),
          fileIdParam(req.params.fileId),
        ),
      );
    },
    async cleanup(_req: Request, res: Response) {
      res.json(await service.cleanupOrphans());
    },
  };
}
