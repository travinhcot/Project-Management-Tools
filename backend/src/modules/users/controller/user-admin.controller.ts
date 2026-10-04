import type { Request, Response } from "express";
import type { UsersService } from "../service/user.service.ts";
import type { ActorLocals } from "../../../shared/request-actor.ts";

import { randomUUID } from "node:crypto";
import { requireActor } from "../../../shared/request-actor.ts";
import {
  accessUpdateBody,
  listUsersQuery,
  userIdParam,
} from "../dto/user-admin.dto.ts";

export function createUserAdminController(service: UsersService) {
  return {
    async list(req: Request, res: Response<unknown, ActorLocals>) {
      requireActor(res.locals);
      res.json(
        await service.listUsers(
          listUsersQuery(req.query as Record<string, unknown>),
        ),
      );
    },
    async updateAccess(
      req: Request<{ userId: string }>,
      res: Response<unknown, ActorLocals>,
    ) {
      const actor = requireActor(res.locals);
      const user = await service.changeAccess(
        actor.userId,
        userIdParam(req.params.userId),
        accessUpdateBody(req.body),
        randomUUID(),
      );
      res.json({ user });
    },
  };
}
