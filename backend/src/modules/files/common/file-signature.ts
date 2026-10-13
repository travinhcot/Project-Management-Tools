import type { FileSlot, FileType } from "../model/resource.model.ts";

import { extensionOf } from "../../../shared/file-signature.ts";
import { ALLOWED_FILE_TYPES } from "../model/resource.model.ts";

export {
  contentProblem,
  extensionOf,
  matchesSignature,
} from "../../../shared/file-signature.ts";

/** The allowed type for this slot and filename extension, or null. */
export function fileTypeFor(slot: FileSlot, filename: string): FileType | null {
  return ALLOWED_FILE_TYPES[slot][extensionOf(filename)] ?? null;
}
