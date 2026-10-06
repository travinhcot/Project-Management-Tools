// Client-side roster CSV preview (SRS FR-ROS-01/02): required headers Full Name and
// Email, optional Department and Birth Year, 1 MB cap. Swap buildPreview/applyImport
// for POST /api/admin/semesters/:id/roster/imports and .../commit once wired.
import {
  DEPARTMENTS,
  type Department,
  type Member,
} from "@/features/members/models/member";

export const MAX_CSV_BYTES = 1024 * 1024;

export type RowStatus = "new" | "update" | "invalid" | "duplicate";

export interface ImportRow {
  /** 1-based record number in the file, header excluded, plus one (the header is row 1). */
  row: number;
  fullName: string;
  email: string;
  department: Department | null;
  birthYear: number | null;
  status: RowStatus;
  note: string;
}

export interface ImportPreview {
  rows: ImportRow[];
  counts: Record<RowStatus, number>;
  /** Active members whose email is not in the file. */
  missing: Member[];
}

export function validateCsvFile(file: File): string | undefined {
  if (!/\.csv$/i.test(file.name)) return "Choose a .csv file.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_CSV_BYTES) return "The file is larger than 1 MB.";
  return undefined;
}

/** RFC-4180-ish: quoted fields, escaped quotes, CRLF, optional BOM. Blank lines are skipped. */
export function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^﻿/, "");

  const endField = () => {
    record.push(field);
    field = "";
  };
  const endRecord = () => {
    endField();
    if (record.some((value) => value.trim() !== "")) records.push(record);
    record = [];
  };

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      endField();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      endRecord();
    } else {
      field += char;
    }
  }
  if (field !== "" || record.length > 0) endRecord();
  return records;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const headerKey = (value: string) => value.toLowerCase().replace(/[\s_-]+/g, "");
const emailKey = (email: string) => email.trim().toLowerCase();

export type PreviewResult =
  | { ok: true; preview: ImportPreview }
  | { ok: false; error: string };

export function buildPreview(text: string, roster: Member[]): PreviewResult {
  const records = parseCsv(text);
  if (records.length === 0) return { ok: false, error: "That file is empty." };

  const headers = records[0].map(headerKey);
  const col = {
    name: headers.indexOf("fullname"),
    email: headers.indexOf("email"),
    department: headers.indexOf("department"),
    birthYear: headers.indexOf("birthyear"),
  };
  if (col.name < 0 || col.email < 0) {
    return {
      ok: false,
      error: "The header row must include Full Name and Email columns.",
    };
  }
  if (records.length === 1) {
    return { ok: false, error: "The file has a header but no member rows." };
  }

  const existing = new Map(roster.map((member) => [emailKey(member.email), member]));
  const cell = (record: string[], index: number) =>
    index < 0 ? "" : (record[index] ?? "").trim();

  const rows: ImportRow[] = records.slice(1).map((record, index) => {
    const fullName = cell(record, col.name);
    const email = cell(record, col.email);
    const departmentRaw = cell(record, col.department);
    const birthRaw = cell(record, col.birthYear);

    const problems: string[] = [];
    if (!fullName) problems.push("Full name is required");
    if (!EMAIL.test(email)) problems.push("email is not valid");
    const department = DEPARTMENTS.find(
      (value) => value === departmentRaw.toLowerCase(),
    );
    if (departmentRaw && !department) problems.push("department must be Software or Hardware");
    const birthYear = birthRaw ? Number(birthRaw) : null;
    if (birthYear !== null && !(Number.isInteger(birthYear) && birthYear >= 1900 && birthYear <= 2100)) {
      problems.push("birth year must be between 1900 and 2100");
    }

    const base = {
      row: index + 2,
      fullName,
      email,
      department: department ?? null,
      birthYear: birthYear !== null && problems.length === 0 ? birthYear : null,
    };
    if (problems.length > 0) {
      const note = problems.join(" · ");
      return { ...base, status: "invalid", note: note.charAt(0).toUpperCase() + note.slice(1) };
    }
    return { ...base, status: "new", note: "" };
  });

  // Last valid row per email wins; earlier ones are flagged as duplicates of it.
  const lastRowByEmail = new Map<string, number>();
  for (const row of rows) {
    if (row.status !== "invalid") lastRowByEmail.set(emailKey(row.email), row.row);
  }

  for (const row of rows) {
    if (row.status === "invalid") continue;
    const key = emailKey(row.email);
    const winner = lastRowByEmail.get(key)!;
    if (winner !== row.row) {
      row.status = "duplicate";
      row.note = `Same email as row ${winner} — only row ${winner} is used`;
      continue;
    }
    const current = existing.get(key);
    if (!current) {
      row.status = "new";
      row.note = "Will be added to the roster";
      continue;
    }
    row.status = "update";
    const nameChanged = current.fullName !== row.fullName;
    const changes: string[] = [];
    if (row.department && row.department !== current.department) changes.push("department updated");
    if (row.birthYear !== null && row.birthYear !== current.birthYear) changes.push("birth year updated");
    if (nameChanged) changes.unshift("Name updated");
    else if (changes.length > 0) changes.unshift("Name unchanged");

    if (changes.length > 0) row.note = changes.join(" · ");
    else if (current.status === "inactive") row.note = "No changes · member will be reactivated";
    else row.note = current.linked ? "Matches existing account" : "No changes";
  }

  const counts: Record<RowStatus, number> = { new: 0, update: 0, invalid: 0, duplicate: 0 };
  for (const row of rows) counts[row.status]++;

  const inFile = new Set(
    rows.filter((row) => row.status !== "invalid").map((row) => emailKey(row.email)),
  );
  const missing = roster.filter(
    (member) => member.status === "active" && !inFile.has(emailKey(member.email)),
  );

  return { ok: true, preview: { rows, counts, missing } };
}

/** Applies new/update rows (and optionally deactivates missing members) to the roster. */
export function applyImport(
  roster: Member[],
  preview: ImportPreview,
  deactivateMissing: boolean,
): Member[] {
  const usable = new Map(
    preview.rows
      .filter((row) => row.status === "new" || row.status === "update")
      .map((row) => [emailKey(row.email), row]),
  );
  const missingIds = new Set(deactivateMissing ? preview.missing.map((m) => m.id) : []);
  const seen = new Set<string>();

  const updated = roster.map((member) => {
    const key = emailKey(member.email);
    const row = usable.get(key);
    seen.add(key);
    if (row) {
      return {
        ...member,
        fullName: row.fullName,
        department: row.department ?? member.department,
        birthYear: row.birthYear ?? member.birthYear,
        status: "active" as const,
      };
    }
    return missingIds.has(member.id) ? { ...member, status: "inactive" as const } : member;
  });

  const added: Member[] = [...usable.entries()]
    .filter(([key]) => !seen.has(key))
    .map(([, row]) => ({
      id: crypto.randomUUID(),
      fullName: row.fullName,
      email: row.email,
      department: row.department,
      birthYear: row.birthYear,
      status: "active",
      linked: false,
    }));

  return [...updated, ...added];
}

export function formatList(names: string[], limit = 3): string {
  if (names.length <= limit) return names.join(", ");
  return `${names.slice(0, limit).join(", ")} and ${names.length - limit} more`;
}
