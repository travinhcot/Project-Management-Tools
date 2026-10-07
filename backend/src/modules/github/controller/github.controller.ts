import type { Request, Response } from "express";
import type { GithubService } from "../service/github.service.ts";
import type { ActorLocals } from "../../../shared/request-actor.ts";

import { uuidParam } from "../../../shared/query-params.ts";
import { requireActor } from "../../../shared/request-actor.ts";

type ProjectRequest = Request<{ projectId: string }>;

const projectId = (req: ProjectRequest) =>
  uuidParam(req.params.projectId, "project id");

export function createGithubController(service: GithubService) {
  return {
    async getAdmin(req: ProjectRequest, res: Response) {
      res.json({ activity: await service.getForAdmin(projectId(req)) });
    },
    async refreshAdmin(req: ProjectRequest, res: Response) {
      res.json({ activity: await service.refreshForAdmin(projectId(req)) });
    },
    async getMember(req: ProjectRequest, res: Response<unknown, ActorLocals>) {
      const actor = requireActor(res.locals);
      res.json({
        activity: await service.getForMember(actor.userId, projectId(req)),
      });
    },
    async refreshAll(_req: Request, res: Response) {
      res.json(await service.refreshAll());
    },
  };
}
