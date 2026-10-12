import type { FileType } from "../../../shared/file-signature.ts";
import type { DepartmentCodeName } from "../../../shared/department-scope.ts";

export type { DepartmentCodeName, FileType };
export { DEPARTMENT_CODES } from "../../../shared/department-scope.ts";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const SIGNED_URL_TTL_SECONDS = 300;
/** Pending uploads older than this are removed by the cleanup job. */
export const ORPHAN_AFTER_MINUTES = 60;

export const MAX_TITLE_LENGTH = 150;
export const MAX_CATEGORY_LENGTH = 50;
export const MAX_DESCRIPTION_LENGTH = 500;

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const office = (kind: string): FileType => ({
  contentType: `application/vnd.openxmlformats-officedocument.${kind}`,
  signature: ZIP,
});

/**
 * What a department library accepts: documents, spreadsheets, slides and images (logos, palettes).
 * No SVG (it can carry script) and no archives. Office files are also checked for macros.
 */
export const ALLOWED_FILE_TYPES: Readonly<Record<string, FileType>> = {
  pdf: { contentType: "application/pdf", signature: [0x25, 0x50, 0x44, 0x46] },
  png: { contentType: "image/png", signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  jpg: { contentType: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  jpeg: { contentType: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  docx: office("wordprocessingml.document"),
  xlsx: office("spreadsheetml.sheet"),
  pptx: office("presentationml.presentation"),
};

/** Content types the upload route accepts as a raw body. */
export const UPLOAD_CONTENT_TYPES: readonly string[] = [
  ...new Set(Object.values(ALLOWED_FILE_TYPES).map((type) => type.contentType)),
];

export interface ResourceFile {
  readonly id: string;
  readonly original_filename: string;
  readonly content_type: string;
  readonly size_bytes: number;
}

export interface DepartmentResource {
  readonly id: string;
  readonly department_code: DepartmentCodeName;
  readonly category: string;
  readonly title: string;
  readonly description: string | null;
  readonly source_type: "LINK" | "FILE";
  readonly url: string | null;
  readonly file: ResourceFile | null;
  readonly updated_by_name: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

/** The text fields of a resource; a missing key means "leave as is", description null clears it. */
export interface ResourceFields {
  readonly title?: string;
  readonly category?: string;
  readonly description?: string | null;
}

export interface LinkCreate extends ResourceFields {
  readonly title: string;
  readonly url: string;
}

export interface ResourceUpdate extends ResourceFields {
  readonly url?: string;
}

export interface UploadRequest {
  readonly actorId: string;
  /** ADMIN must name a department; for everyone else the database decides. */
  readonly department: DepartmentCodeName | null;
  /** Set to replace the file (or link) of an existing resource; unset creates a new resource. */
  readonly resourceId: string | null;
  readonly fields: ResourceFields;
  readonly filename: string;
  /** The request Content-Type, without parameters. */
  readonly declaredType: string;
  readonly bytes: Buffer;
  readonly requestId: string;
}

export interface FileTarget {
  readonly bucket_id: string;
  readonly object_path: string;
  readonly original_filename: string;
}

export interface DownloadUrl {
  readonly url: string;
  readonly expires_in: number;
  readonly filename: string;
}
