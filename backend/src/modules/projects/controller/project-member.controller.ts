import type { Request, Response } from "express";
import type { ProjectMemberService } from "../service/project-member.service.ts";
import type { ActorLocals } from "../../../shared/request-actor.ts";

import { randomUUID } from "node:crypto";
import { requireActor } from "../../../shared/request-actor.ts";
import {
  projectIdParam,
  rosterMemberIdParam,
} from "../common/project-params.ts";
import { assignMembersBody } from "../dto/project-member.dto.ts";

export function createProjectMemberController(service: ProjectMemberService) {
  return {
    async assign(
      req: Request<{ projectId: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      const actor = requireActor(res.locals);
      const request = assignMembersBody(req.body);
      const result = await service.assign(
        actor.userId,
        projectIdParam(req.params.projectId),
        request,
        randomUUID(),
      );
      if (request.mode === "single") {
        const member = result.accepted[0];
        res.status(201).json({ member });
        return;
      }
      res.json(result);
    },

    async remove(
      req: Request<{ projectId: string; rosterMemberId: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      const actor = requireActor(res.locals);
      const assignment = await service.remove(
        actor.userId,
        projectIdParam(req.params.projectId),
        rosterMemberIdParam(req.params.rosterMemberId),
        randomUUID(),
      );
      res.json({ assignment });
    },
  };
}
