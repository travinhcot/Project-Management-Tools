import type { Request, Response } from "express";
import type { RosterMemberService } from "../service/roster-member.service.ts";
import type { ActorLocals } from "../../../shared/request-actor.ts";

import { randomUUID } from "node:crypto";
import { requireActor } from "../../../shared/request-actor.ts";
import { rosterMemberIdParam, semesterIdParam } from "../common/member-params.ts";
import {
  createRosterMemberBody,
  listRosterQuery,
  updateRosterMemberBody,
} from "../dto/roster-member.dto.ts";

export function createRosterMemberController(service: RosterMemberService) {
  return {
    async list(req: Request<{ semesterId: string }>, res: Response<unknown, ActorLocals>) {
      requireActor(res.locals);
      res.json(
        await service.list(
          listRosterQuery(req.params.semesterId, req.query as Record<string, unknown>),
        ),
      );
    },
    async add(req: Request<{ semesterId: string }>, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      const member = await service.add(
        actor.userId,
        semesterIdParam(req.params.semesterId),
        createRosterMemberBody(req.body),
        randomUUID(),
      );
      res.status(201).json({ member });
    },
    async update(req: Request<{ rosterMemberId: string }>, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      const member = await service.update(
        actor.userId,
        rosterMemberIdParam(req.params.rosterMemberId),
        updateRosterMemberBody(req.body),
        randomUUID(),
      );
      res.json({ member });
    },
    async deleteImpact(req: Request<{ rosterMemberId: string }>, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      const impact = await service.deleteImpact(
        actor.userId,
        rosterMemberIdParam(req.params.rosterMemberId),
      );
      res.json({ impact });
    },
    async remove(req: Request<{ rosterMemberId: string }>, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      const result = await service.delete(
        actor.userId,
        rosterMemberIdParam(req.params.rosterMemberId),
        randomUUID(),
      );
      res.json({ deleted: true, auth_user_removed: result.authUserRemoved });
    },
  };
}
