import type { Request, Response } from "express";
import type { AuthService } from "../service/auth.service.ts";
import type { AuthLocals } from "../model/auth.model.ts";

import {
  bodyFields,
  emailInput,
  otpInput,
  refreshTokenInput,
  fullNameInput,
} from "../dto/auth.dto.ts";

export function createAuthController(service: AuthService) {
  return {
    async requestOtp(req: Request, res: Response<unknown, AuthLocals>) {
      const body = bodyFields(req.body, ["email"]);
      await service.requestOtp(emailInput(body.email));
      res
        .status(202)
        .json({
          message: "If this account exists, a sign-in email will be sent.",
        });
    },
    async verifyOtp(req: Request, res: Response<unknown, AuthLocals>) {
      const body = bodyFields(req.body, ["email", "token"]);
      res.json(
        await service.verifyOtp(emailInput(body.email), otpInput(body.token)),
      );
    },
    async refresh(req: Request, res: Response<unknown, AuthLocals>) {
      const body = bodyFields(req.body, ["refresh_token"]);
      res.json(await service.refresh(refreshTokenInput(body.refresh_token)));
    },
    async logout(_req: Request, res: Response<unknown, AuthLocals>) {
      await service.logout(res.locals.accessToken!);
      res.status(204).end();
    },
    me(_req: Request, res: Response<unknown, AuthLocals>) {
      res.json({ user: res.locals.auth!.profile });
    },
    async updateProfile(req: Request, res: Response<unknown, AuthLocals>) {
      const body = bodyFields(req.body, ["full_name"]);
      const user = await service.updateProfile(
        res.locals.auth!.identity,
        fullNameInput(body.full_name),
      );
      res.json({ user });
    },
  };
}
