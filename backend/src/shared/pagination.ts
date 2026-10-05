import { positiveInt, single } from "./query-params.ts";

export interface PageRequest {
  readonly page: number;
  readonly size: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly total: number;
}

export function pageOf(
  query: Record<string, unknown>,
  defaultSize = 20,
): PageRequest {
  return {
    page: positiveInt(single(query, "page"), 1, 100_000, "page"),
    size: positiveInt(single(query, "size"), defaultSize, 100, "size"),
  };
}
