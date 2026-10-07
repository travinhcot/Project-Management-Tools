// Client-side checks before a roster CSV is uploaded. The backend (POST
// /api/admin/semesters/:id/roster/imports) re-validates everything and owns the row rules.
export const MAX_CSV_BYTES = 1024 * 1024;

export function validateCsvFile(file: File): string | undefined {
  if (!/\.csv$/i.test(file.name)) return "Choose a .csv file.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_CSV_BYTES) return "The file is larger than 1 MB.";
  return undefined;
}
