import {
  BOM_EXTENSIONS,
  MAX_FILE_BYTES,
  MAX_LABEL_LENGTH,
  MAX_URL_LENGTH,
} from "@/features/projects/models/project";

// Mirrors backend/src/modules/files/dto/resource.dto.ts and model/resource.model.ts.

export function validateHttpsUrl(raw: string): string | undefined {
  const url = raw.trim();
  if (!url) return "Enter a link.";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Enter a valid link, for example https://meet.example.edu/room.";
  }
  if (parsed.protocol !== "https:" || !parsed.hostname)
    return "The link must start with https://.";
  if (url.length > MAX_URL_LENGTH)
    return `Use ${MAX_URL_LENGTH} characters or fewer.`;
}

export function validateLabel(raw: string): string | undefined {
  if ([...raw.trim()].length > MAX_LABEL_LENGTH)
    return `Use ${MAX_LABEL_LENGTH} characters or fewer.`;
}

export function validateBomFile(file: File): string | undefined {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!file.name.includes(".") || !(BOM_EXTENSIONS as readonly string[]).includes(extension))
    return "Upload an .xlsx or .pdf file.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_FILE_BYTES) return "The file must be 10 MB or smaller.";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
