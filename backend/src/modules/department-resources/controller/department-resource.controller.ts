import type { Request, Response } from "express";
import type { DepartmentResourceService } from "../service/department-resource.service.ts";
import type { ActorLocals } from "../../../shared/request-actor.ts";

import { randomUUID } from "node:crypto";
import { HttpError } from "../../../shared/http-error.ts";
import { requireActor } from "../../../shared/request-actor.ts";
import {
  departmentQuery,
  linkBody,
  projectCountsQuery,
  projectIdParam,
  projectLinksBody,
  resourceIdParam,
  updateBody,
  uploadQuery,
} from "../dto/department-resource.dto.ts";

type IdRequest = Request<{ resourceId: string }>;

export function createDepartmentResourceController(service: DepartmentResourceService) {
  return {
    async list(req: Request, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      const department = departmentQuery(req.query as Record<string, unknown>);
      res.json({ resources: await service.list(actor.userId, department) });
    },
    async projectLinkCounts(req: Request, res: Response<unknown, ActorLocals>) {
      requireActor(res.locals);
      const ids = projectCountsQuery(req.query as Record<string, unknown>);
      res.json({ counts: await service.projectLinkCounts(ids) });
    },
    async projectResources(
      req: Request<{ projectId: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      const actor = requireActor(res.locals);
      res.json(await service.projectResources(actor.userId, projectIdParam(req.params.projectId)));
    },
    async setProjectResources(
      req: Request<{ projectId: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      const actor = requireActor(res.locals);
      res.json(
        await service.setProjectResources(
          actor.userId,
          projectIdParam(req.params.projectId),
          projectLinksBody(req.body),
          randomUUID(),
        ),
      );
    },
    async createLink(req: Request, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      const { department, link } = linkBody(req.body);
      const resource = await service.createLink(actor.userId, department, link, randomUUID());
      res.status(201).json({ resource });
    },
    async upload(req: Request, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      const query = uploadQuery(req);
      if (!Buffer.isBuffer(req.body)) {
        throw new HttpError(
          415,
          "UNSUPPORTED_MEDIA_TYPE",
          "Send the file as the raw request body with its own Content-Type.",
        );
      }
      const resource = await service.upload({
        actorId: actor.userId,
        department: query.department,
        resourceId: query.resourceId,
        fields: query.fields,
        filename: query.filename,
        declaredType: (req.get("content-type") ?? "").split(";")[0].trim().toLowerCase(),
        bytes: req.body,
        requestId: randomUUID(),
      });
      res.status(query.resourceId ? 200 : 201).json({ resource });
    },
    async update(req: IdRequest, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      const { department, changes } = updateBody(req.body);
      const resource = await service.update(
        actor.userId,
        department,
        resourceIdParam(req.params.resourceId),
        changes,
        randomUUID(),
      );
      res.json({ resource });
    },
    async remove(req: IdRequest, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      await service.remove(
        actor.userId,
        departmentQuery(req.query as Record<string, unknown>),
        resourceIdParam(req.params.resourceId),
        randomUUID(),
      );
      res.status(204).end();
    },
    async downloadUrl(req: IdRequest, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      res.json(
        await service.downloadUrl(
          actor.userId,
          departmentQuery(req.query as Record<string, unknown>),
          resourceIdParam(req.params.resourceId),
        ),
      );
    },
    async cleanup(_req: Request, res: Response) {
      res.json(await service.cleanupOrphans());
    },
  };
}
