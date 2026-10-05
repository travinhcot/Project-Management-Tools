import type { Request, Response } from "express";
import type { SemesterService } from "../service/semester.service.ts";
import type { ActorLocals } from "../../../shared/request-actor.ts";

import { randomUUID } from "node:crypto";
import { requireActor } from "../../../shared/request-actor.ts";
import {
  createSemesterBody,
  listSemestersQuery,
  semesterIdParam,
  updateSemesterBody,
} from "../dto/semester-admin.dto.ts";

export function createSemesterAdminController(service: SemesterService) {
  return {
    async list(req: Request, res: Response<unknown, ActorLocals>) {
      requireActor(res.locals);
      res.json({
        items: await service.list(listSemestersQuery(req.query as Record<string, unknown>)),
      });
    },
    async get(req: Request<{ semesterId: string }>, res: Response<unknown, ActorLocals>) {
      requireActor(res.locals);
      res.json({ semester: await service.get(semesterIdParam(req.params.semesterId)) });
    },
    async create(req: Request, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      const semester = await service.create(actor.userId, createSemesterBody(req.body), randomUUID());
      res.status(201).json({ semester });
    },
    async update(req: Request<{ semesterId: string }>, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      const semester = await service.update(
        actor.userId,
        semesterIdParam(req.params.semesterId),
        updateSemesterBody(req.body),
        randomUUID(),
      );
      res.json({ semester });
    },
    async currentImpact(req: Request<{ semesterId: string }>, res: Response<unknown, ActorLocals>) {
      requireActor(res.locals);
      res.json({ impact: await service.currentImpact(semesterIdParam(req.params.semesterId)) });
    },
    async setCurrent(req: Request<{ semesterId: string }>, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      const semester = await service.setCurrent(
        actor.userId,
        semesterIdParam(req.params.semesterId),
        randomUUID(),
      );
      res.json({ semester });
    },
  };
}
