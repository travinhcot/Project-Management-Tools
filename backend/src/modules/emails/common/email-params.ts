import { uuidParam } from "../../../shared/query-params.ts";

export const campaignIdParam = (value: unknown) =>
  uuidParam(value, "campaign id");
export const deliveryIdParam = (value: unknown) =>
  uuidParam(value, "delivery id");
export const projectIdParam = (value: unknown) =>
  uuidParam(value, "project id");
export const semesterIdParam = (value: unknown) =>
  uuidParam(value, "semester id");
