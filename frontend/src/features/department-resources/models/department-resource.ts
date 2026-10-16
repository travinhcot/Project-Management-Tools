// Mirrors DepartmentResource in backend/src/modules/department-resources/model/department-resource.model.ts
// (snake_case there, camelCase here). Mapping lives in service/department-resources.service.ts.
import type { DepartmentCode } from "@/config/departments";

export interface DepartmentResource {
  id: string;
  departmentCode: DepartmentCode;
  category: string;
  title: string;
  description: string | null;
  kind: "link" | "file";
  /** Set for a link. */
  url: string | null;
  /** Set for a file. */
  filename: string | null;
  sizeBytes: number | null;
  updatedByName: string | null;
  /** ISO timestamp. */
  updatedAt: string;
}

export const TITLE_MAX_LENGTH = 150;
export const CATEGORY_MAX_LENGTH = 50;
export const DESCRIPTION_MAX_LENGTH = 500;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Mirrors ALLOWED_FILE_TYPES in the backend model: the exact Content-Type per extension. */
export const CONTENT_TYPES: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
export const FILE_ACCEPT = Object.keys(CONTENT_TYPES)
  .map((extension) => `.${extension}`)
  .join(",");

export function validateFile(file: File): string | undefined {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!file.name.includes(".") || !CONTENT_TYPES[extension]) {
    return "Upload a PDF, image (PNG or JPG), Word, Excel or PowerPoint file.";
  }
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_FILE_BYTES) return "The file must be 10 MB or smaller.";
}
