import { uuidParam } from "../../../shared/query-params.ts";

export const semesterIdParam = (value: unknown) =>
  uuidParam(value, "semester id");
export const importIdParam = (value: unknown) => uuidParam(value, "import id");
