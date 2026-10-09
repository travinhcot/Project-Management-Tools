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

const MAX_ZIP_ENTRIES = 1000;
const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

/** Entry names (central directory) of a ZIP, or null when it is malformed, encrypted or oversized. */
function zipEntryNames(bytes: Buffer): string[] | null {
  const earliest = Math.max(0, bytes.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= earliest; i--) {
    if (bytes.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = bytes.readUInt16LE(eocd + 10);
  const directoryStart = bytes.readUInt32LE(eocd + 16);
  // 0xFFFF / 0xFFFFFFFF mean ZIP64, which Office files do not need at 10 MB.
  if (count === 0xffff || directoryStart === 0xffffffff) return null;
  if (count === 0 || count > MAX_ZIP_ENTRIES) return null;

  const names: string[] = [];
  let total = 0;
  let at = directoryStart;
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.length || bytes.readUInt32LE(at) !== CENTRAL_SIGNATURE)
      return null;
    const flags = bytes.readUInt16LE(at + 8);
    const size = bytes.readUInt32LE(at + 24);
    const nameLength = bytes.readUInt16LE(at + 28);
    const extraLength = bytes.readUInt16LE(at + 30);
    const commentLength = bytes.readUInt16LE(at + 32);
    if (flags & 1) return null; // encrypted
    total += size;
    if (total > MAX_UNCOMPRESSED_BYTES) return null;
    if (at + 46 + nameLength > bytes.length) return null;
    names.push(bytes.toString("utf8", at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

const OFFICE_MAIN_PART: Record<string, string> = {
  docx: "word/document.xml",
  xlsx: "xl/workbook.xml",
};

/** PDF names that run code or open other files. */
const PDF_ACTIVE_CONTENT =
  /\/(?:JavaScript|JS|Launch|OpenAction|AA|EmbeddedFile)(?![A-Za-z0-9])/;

/**
 * Structure checks beyond the magic number, so a renamed archive or a document with macros or
 * scripts is refused. Byte-level only (nothing is rendered or unpacked); a PDF that hides the
 * markers inside compressed object streams is not detected.
 */
export function contentProblem(bytes: Buffer, extension: string): string | null {
  if (extension === "pdf") {
    const text = bytes.toString("latin1");
    if (!text.startsWith("%PDF-") || !text.slice(-1024).includes("%%EOF"))
      return "The PDF is damaged.";
    if (PDF_ACTIVE_CONTENT.test(text))
      return "PDFs with scripts, launch actions or attachments are not accepted.";
    return null;
  }
  const mainPart = OFFICE_MAIN_PART[extension];
  if (!mainPart) return null;
  const names = zipEntryNames(bytes);
  if (!names) return "The file is not a valid Office document.";
  if (!names.includes("[Content_Types].xml") || !names.includes(mainPart))
    return "The file content does not match its extension.";
  if (names.some((name) => /vbaProject\.bin$|(^|\/)macros?\//i.test(name)))
    return "Documents with macros are not accepted.";
  return null;
}
