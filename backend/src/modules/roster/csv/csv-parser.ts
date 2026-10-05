/** RFC 4180 CSV parser: quoted fields, "" escapes, CRLF/LF, UTF-8 BOM. No dependencies. */
export class CsvSyntaxError extends Error {}

export interface CsvRecord {
  /** 1-based line of the file where the record starts (what a spreadsheet shows as the row). */
  readonly line: number;
  readonly fields: string[];
}

export function parseCsv(text: string): CsvRecord[] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let quoted = false;
  let line = 1;
  let startLine = 1;
  let i = 0;

  const endRecord = () => {
    fields.push(field);
    records.push({ line: startLine, fields });
    fields = [];
    field = "";
  };

  while (i < input.length) {
    const ch = input[i]!;
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        const next = input[i];
        if (
          next !== undefined &&
          next !== "," &&
          next !== "\r" &&
          next !== "\n"
        ) {
          throw new CsvSyntaxError(
            `Unexpected character after a closing quote on line ${line}.`,
          );
        }
        continue;
      }
      if (ch === "\n" || (ch === "\r" && input[i + 1] !== "\n")) line++;
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      if (field !== "")
        throw new CsvSyntaxError(`Unexpected quote on line ${line}.`);
      quoted = true;
      i++;
      continue;
    }
    if (ch === ",") {
      fields.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      endRecord();
      i += ch === "\r" && input[i + 1] === "\n" ? 2 : 1;
      line++;
      startLine = line;
      continue;
    }
    field += ch;
    i++;
  }
  if (quoted) throw new CsvSyntaxError("A quoted field is never closed.");
  if (field !== "" || fields.length) endRecord();
  // Drop fully blank lines (Excel often appends them).
  // Also covers comma-only rows such as ",,".
  return records.filter((r) => !r.fields.every((f) => f.trim() === ""));
}
