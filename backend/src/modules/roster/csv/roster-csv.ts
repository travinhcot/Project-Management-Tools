import type {
  ImportRowInput,
  ParsedRosterCsv,
} from "../model/roster-import.model.ts";

import {
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  emailProblem,
  nameProblem,
  normalizeEmail,
  studentIdProblem,
} from "../../../shared/roster-rules.ts";
import { CsvSyntaxError, parseCsv } from "./csv-parser.ts";

export const MAX_IMPORT_ROWS = 5000;

/** The file as a whole is unusable (nothing is stored). Row-level problems are not errors. */
export class RosterCsvError extends Error {}

const headerKey = (cell: string) =>
  cell.trim().replace(/\s+/g, " ").toLowerCase();
const clip = (value: string, max: number) => [...value].slice(0, max).join("");

export function parseRosterCsv(text: string): ParsedRosterCsv {
  let records;
  try {
    records = parseCsv(text);
  } catch (error) {
    if (error instanceof CsvSyntaxError)
      throw new RosterCsvError(error.message);
    throw error;
  }
  if (records.length === 0) throw new RosterCsvError("The file is empty.");

  const header = records[0]!.fields;
  const columns = new Map<string, number>();
  const ignored: string[] = [];
  header.forEach((cell, index) => {
    const key = headerKey(cell);
    if (key === "full name" || key === "email" || key === "student id") {
      if (columns.has(key))
        throw new RosterCsvError(`Duplicate column: ${cell.trim()}.`);
      columns.set(key, index);
    } else if (cell.trim()) {
      ignored.push(cell.trim());
    }
  });
  for (const [key, label] of [
    ["full name", "Full Name"],
    ["email", "Email"],
  ] as const) {
    if (!columns.has(key))
      throw new RosterCsvError(`Missing required column: ${label}.`);
  }

  const dataRecords = records.slice(1);
  if (dataRecords.length === 0)
    throw new RosterCsvError("The file has a header but no data rows.");
  if (dataRecords.length > MAX_IMPORT_ROWS) {
    throw new RosterCsvError(`The file has more than ${MAX_IMPORT_ROWS} rows.`);
  }

  const nameIndex = columns.get("full name")!;
  const emailIndex = columns.get("email")!;
  const studentIdIndex = columns.get("student id");

  const rows: ImportRowInput[] = dataRecords.map((record) => {
    const cell = (index: number | undefined) =>
      index === undefined ? "" : (record.fields[index] ?? "").trim();
    const fullName = cell(nameIndex);
    const email = cell(emailIndex);
    const studentId = cell(studentIdIndex);
    const errors: string[] = [];

    if (record.fields.length !== header.length) {
      errors.push(
        `Expected ${header.length} columns but found ${record.fields.length}.`,
      );
    }
    const nameError = nameProblem(fullName);
    if (nameError) errors.push(nameError);
    const emailError = emailProblem(email);
    if (emailError) errors.push(emailError);
    const studentIdError = studentIdProblem(studentId);
    if (studentIdError) errors.push(studentIdError);

    return {
      row_number: record.line,
      full_name: clip(fullName, MAX_NAME_LENGTH),
      email: clip(email, MAX_EMAIL_LENGTH),
      other_info: studentId && !studentIdError ? { student_id: studentId } : {},
      status: errors.length ? "INVALID" : "VALID",
      errors,
    };
  });

  // The same person twice in one file: every occurrence is a DUPLICATE and none is imported.
  const seen = new Map<string, number[]>();
  for (const row of rows) {
    if (row.status !== "VALID") continue;
    const key = normalizeEmail(row.email);
    seen.set(key, [...(seen.get(key) ?? []), row.row_number]);
  }
  const duplicated = rows.map((row): ImportRowInput => {
    const lines =
      row.status === "VALID" ? seen.get(normalizeEmail(row.email)) : undefined;
    if (!lines || lines.length < 2) return row;
    return {
      ...row,
      status: "DUPLICATE",
      errors: [
        `This email appears more than once in the file (rows ${lines.join(", ")}).`,
      ],
    };
  });

  return { rows: duplicated, ignored_columns: ignored };
}
