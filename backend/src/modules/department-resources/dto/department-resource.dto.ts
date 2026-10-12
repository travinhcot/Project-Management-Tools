import type { Request } from "express";
import type {
  DepartmentCodeName,
  LinkCreate,
  ResourceFields,
  ResourceUpdate,
} from "../model/department-resource.model.ts";

import {
  invalid,
  objectBody,
  rejectUnknownKeys,
  single,
  uuidParam,
} from "../../../shared/query-params.ts";
import {
  DEPARTMENT_CODES,
  MAX_CATEGORY_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
} from "../model/department-resource.model.ts";

export const resourceIdParam = (value: unknown) => uuidParam(value, "resource id");

function departmentValue(value: unknown): DepartmentCodeName | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !DEPARTMENT_CODES.includes(value as DepartmentCodeName)) {
    invalid(`department must be one of ${DEPARTMENT_CODES.join(", ")}.`);
  }
  return value as DepartmentCodeName;
}

function titleValue(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) invalid("title is required.");
  const title = value.trim();
  if ([...title].length > MAX_TITLE_LENGTH) invalid(`title must be at most ${MAX_TITLE_LENGTH} characters.`);
  return title;
}

function categoryValue(value: unknown): string {
  if (typeof value !== "string") invalid("category must be text.");
  const category = value.trim() || "General";
  if ([...category].length > MAX_CATEGORY_LENGTH) invalid(`category must be at most ${MAX_CATEGORY_LENGTH} characters.`);
  return category;
}

function descriptionValue(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") invalid("description must be text or null.");
  const description = value.trim();
  if ([...description].length > MAX_DESCRIPTION_LENGTH) {
    invalid(`description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`);
  }
  return description || null;
}

export function urlValue(value: unknown): string {
  if (typeof value !== "string") invalid("url must be a valid https:// URL.");
  const url = value.trim();
  let protocol = "";
  let hostname = "";
  try {
    const parsed = new URL(url);
    protocol = parsed.protocol;
    hostname = parsed.hostname;
  } catch {
    invalid("url must be a valid https:// URL.");
  }
  if (protocol !== "https:" || !hostname || url.length > 2048) {
    invalid("url must be a valid https:// URL (at most 2048 characters).");
  }
  return url;
}

/** `?department=` only. */
export function departmentQuery(query: Record<string, unknown>): DepartmentCodeName | null {
  rejectUnknownKeys(query, ["department"], "The request contains invalid query parameters.");
  return departmentValue(single(query, "department"));
}

export function linkBody(body: unknown): { department: DepartmentCodeName | null; link: LinkCreate } {
  const input = objectBody(body);
  rejectUnknownKeys(
    input,
    ["department", "title", "category", "description", "url"],
    "Only department, title, category, description and url can be provided.",
  );
  return {
    department: departmentValue(input.department),
    link: {
      title: titleValue(input.title),
      url: urlValue(input.url),
      ...(input.category === undefined ? {} : { category: categoryValue(input.category) }),
      ...(input.description === undefined ? {} : { description: descriptionValue(input.description) }),
    },
  };
}

export function updateBody(body: unknown): { department: DepartmentCodeName | null; changes: ResourceUpdate } {
  const input = objectBody(body);
  rejectUnknownKeys(
    input,
    ["department", "title", "category", "description", "url"],
    "Only department, title, category, description and url can be provided.",
  );
  const changes: { -readonly [K in keyof ResourceUpdate]: ResourceUpdate[K] } = {};
  if (input.title !== undefined) changes.title = titleValue(input.title);
  if (input.category !== undefined) changes.category = categoryValue(input.category);
  if (input.description !== undefined) changes.description = descriptionValue(input.description);
  if (input.url !== undefined) changes.url = urlValue(input.url);
  if (Object.keys(changes).length === 0) invalid("Provide at least one of title, category, description or url.");
  return { department: departmentValue(input.department), changes };
}

/** Upload metadata travels in the query string because the body is the raw file. */
export function uploadQuery(req: Pick<Request, "query">): {
  department: DepartmentCodeName | null;
  resourceId: string | null;
  filename: string;
  fields: ResourceFields;
} {
  const query = req.query as Record<string, unknown>;
  rejectUnknownKeys(
    query,
    ["filename", "department", "resource_id", "title", "category", "description"],
    "The request contains invalid query parameters.",
  );
  const rawName = single(query, "filename");
  if (rawName === undefined) invalid("Query parameter filename is required.");
  // Quotes, semicolons and percent signs would reach the Content-Disposition header.
  const filename = rawName
    .normalize("NFC")
    .split(/[\\/]/)
    .pop()!
    .replace(/["';%]/g, "")
    .trim();
  // eslint-disable-next-line no-control-regex
  if (!filename || [...filename].length > 255 || /[\u0000-\u001f\u007f]/.test(filename)) {
    invalid("filename must be 1-255 characters without control characters.");
  }
  if (!/\.[A-Za-z0-9]{1,10}$/.test(filename)) invalid("filename needs a file extension.");

  const resourceId = single(query, "resource_id");
  const title = single(query, "title");
  const category = single(query, "category");
  const description = single(query, "description");
  // A new resource needs a title; a replacement keeps the existing one unless given.
  if (resourceId === undefined && title === undefined) invalid("Query parameter title is required.");
  return {
    department: departmentValue(single(query, "department")),
    resourceId: resourceId === undefined ? null : uuidParam(resourceId, "resource_id"),
    filename,
    fields: {
      ...(title === undefined ? {} : { title: titleValue(title) }),
      ...(category === undefined ? {} : { category: categoryValue(category) }),
      ...(description === undefined ? {} : { description: descriptionValue(description) }),
    },
  };
}
