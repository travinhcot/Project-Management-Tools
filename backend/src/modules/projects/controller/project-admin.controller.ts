import type { Request, Response } from "express";
import type { ProjectService } from "../service/project.service.ts";
import type { ActorLocals } from "../../../shared/request-actor.ts";

import { randomUUID } from "node:crypto";
import { requireActor } from "../../../shared/request-actor.ts";
import { projectIdParam } from "../common/project-params.ts";
import {
  archiveProjectBody,
  createProjectBody,
  listProjectsQuery,
  updateProjectBody,
} from "../dto/project-admin.dto.ts";

type IdRequest = Request<{ projectId: string }>;

export function createProjectAdminController(service: ProjectService) {
  return {
    async list(req: Request, res: Response<unknown, ActorLocals>) {
      requireActor(res.locals);
      res.json(
        await service.list(
          listProjectsQuery(req.query as Record<string, unknown>),
        ),
      );
    },
    async get(req: IdRequest, res: Response<unknown, ActorLocals>) {
      requireActor(res.locals);
      res.json(await service.get(projectIdParam(req.params.projectId)));
    },
    async create(req: Request, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      const project = await service.create(
        actor.userId,
        createProjectBody(req.body),
        randomUUID(),
      );
      res.status(201).json({ project });
    },
    async update(req: IdRequest, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      const id = projectIdParam(req.params.projectId);
      const body = updateProjectBody(req.body);
      const project = await service.update(
        actor.userId,
        id,
        body.expected_updated_at,
        body.changes,
        randomUUID(),
      );
      res.json({ project });
    },
    async archiveImpact(req: IdRequest, res: Response<unknown, ActorLocals>) {
      requireActor(res.locals);
      res.json({
        impact: await service.archiveImpact(
          projectIdParam(req.params.projectId),
        ),
      });
    },
    async archive(req: IdRequest, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      const project = await service.archive(
        actor.userId,
        projectIdParam(req.params.projectId),
        archiveProjectBody(req.body),
        randomUUID(),
      );
      res.json({ project });
    },
    async unarchive(req: IdRequest, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      const project = await service.unarchive(
        actor.userId,
        projectIdParam(req.params.projectId),
        randomUUID(),
      );
      res.json({ project });
    },
  };
}
