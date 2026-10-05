import { uuidParam } from "../../../shared/query-params.ts";

export const semesterIdParam = (value: unknown) =>
  uuidParam(value, "semester id");
export const rosterMemberIdParam = (value: unknown) =>
  uuidParam(value, "roster member id");
