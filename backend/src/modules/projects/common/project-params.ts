import { uuidParam } from "../../../shared/query-params.ts";

export const projectIdParam = (value: unknown) =>
  uuidParam(value, "project id");
export const semesterIdParam = (value: unknown) =>
  uuidParam(value, "semester id");
