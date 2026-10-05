export const RESOURCE_SLOTS = [
  "SRS",
  "FIRST_MEETING",
  "BOM",
] as const;
export type ResourceSlot = (typeof RESOURCE_SLOTS)[number];

export type ProjectType = "SOFTWARE" | "HARDWARE";
export type ResourceSource = "LINK" | "FILE";

export const FILE_SLOTS = ["SRS", "BOM"] as const;
export type FileSlot = (typeof FILE_SLOTS)[number];

/** Slots a project of this type must fill to be complete. */
export function requiredSlots(type: ProjectType): readonly ResourceSlot[] {
  return type === "HARDWARE"
    ? RESOURCE_SLOTS
    : RESOURCE_SLOTS.filter((slot) => slot !== "BOM");
}

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const SIGNED_URL_TTL_SECONDS = 300;
/** Pending uploads older than this are removed by the cleanup job. */
export const ORPHAN_AFTER_MINUTES = 60;

export interface FileType {
  readonly contentType: string;
  /** Leading bytes that must match (magic number). */
  readonly signature: readonly number[];
}

const PDF: FileType = {
  contentType: "application/pdf",
  signature: [0x25, 0x50, 0x44, 0x46], // %PDF
};
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04
const DOCX: FileType = {
  contentType:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  signature: ZIP,
};
const XLSX: FileType = {
  contentType:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  signature: ZIP,
};

/** Allowed extensions per file slot (D-07 default), each with its detected-type rule. */
export const ALLOWED_FILE_TYPES: Record<
  FileSlot,
  Readonly<Record<string, FileType>>
> = {
  SRS: { pdf: PDF, docx: DOCX },
  BOM: { xlsx: XLSX, pdf: PDF },
};

/** Content types the upload route accepts as a raw body. */
export const UPLOAD_CONTENT_TYPES: readonly string[] = [
  ...new Set(
    Object.values(ALLOWED_FILE_TYPES).flatMap((types) =>
      Object.values(types).map((type) => type.contentType),
    ),
  ),
];

export interface ResourceFile {
  readonly id: string;
  readonly original_filename: string;
  readonly content_type: string;
  readonly size_bytes: number;
  readonly created_at: string;
}

export interface Resource {
  readonly slot: ResourceSlot;
  readonly source_type: ResourceSource;
  readonly url: string | null;
  readonly label: string | null;
  readonly file: ResourceFile | null;
  readonly updated_at: string;
}

export interface ResourceSummary {
  readonly present: readonly ResourceSlot[];
  readonly missing: readonly ResourceSlot[];
  readonly complete: boolean;
}

export interface UploadRequest {
  readonly actorId: string;
  readonly projectId: string;
  readonly slot: FileSlot;
  readonly filename: string;
  /** The request's Content-Type, without parameters. */
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
