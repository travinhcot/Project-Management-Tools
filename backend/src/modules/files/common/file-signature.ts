import type { FileSlot, FileType } from "../model/resource.model.ts";

import { ALLOWED_FILE_TYPES } from "../model/resource.model.ts";

export function extensionOf(filename: string): string {
  return filename.split(".").pop()!.toLowerCase();
}

/** The allowed type for this slot and filename extension, or null. */
export function fileTypeFor(slot: FileSlot, filename: string): FileType | null {
  return ALLOWED_FILE_TYPES[slot][extensionOf(filename)] ?? null;
}

/** True when the bytes start with the magic number of the claimed type. */
export function matchesSignature(bytes: Buffer, type: FileType): boolean {
  return (
    bytes.length >= type.signature.length &&
    type.signature.every((byte, index) => bytes[index] === byte)
  );
}
