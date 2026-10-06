import type {
  Semester,
  SemesterInput,
  SemesterPhase,
} from "@/features/semesters/models/semester";
import { validateHttpsUrl } from "@/features/projects/utils/validation";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const semesterName = (term: string, year: number) => `Sem ${term} ${year}`;

/** "Sem B" (the term without the year), as shown in the page header badge. */
export const shortName = (semester: Pick<Semester, "term">) => `Sem ${semester.term}`;

function parts(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month: MONTHS[month - 1], day };
}

/** "28 Sep – 20 Dec 2026", "28 Dec 2026 – 3 Mar 2027", or "—" when no dates are set. */
export function formatRange(startsOn: string | null, endsOn: string | null): string {
  if (!startsOn && !endsOn) return "—";
  if (startsOn && !endsOn) {
    const s = parts(startsOn);
    return `From ${s.day} ${s.month} ${s.year}`;
  }
  if (!startsOn && endsOn) {
    const e = parts(endsOn);
    return `Until ${e.day} ${e.month} ${e.year}`;
  }
  const s = parts(startsOn!);
  const e = parts(endsOn!);
  const start = s.year === e.year ? `${s.day} ${s.month}` : `${s.day} ${s.month} ${s.year}`;
  return `${start} – ${e.day} ${e.month} ${e.year}`;
}

/** `today` is a yyyy-mm-dd string supplied by the server so render stays pure. */
export function getPhase(semester: Semester, today: string): SemesterPhase {
  if (semester.isCurrent) return "current";
  if (semester.endsOn && semester.endsOn < today) return "past";
  return "upcoming";
}

/** Current first, then newest start date first; undated semesters last. */
export function sortSemesters(semesters: Semester[]): Semester[] {
  return [...semesters].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    return (b.startsOn ?? "").localeCompare(a.startsOn ?? "") || b.year - a.year;
  });
}

export interface SemesterFormErrors {
  year?: string;
  endsOn?: string;
  demoRegistrationUrl?: string;
  term?: string;
}

/** Pre-checks that mirror the backend rules: year 2000–2100, end not before start, https URL, unique term+year. */
export function validateSemester(
  input: SemesterInput,
  existing: Semester[],
  editingId?: string,
): SemesterFormErrors {
  const errors: SemesterFormErrors = {};
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
    errors.year = "Enter a year between 2000 and 2100.";
  }
  if (input.startsOn && input.endsOn && input.endsOn < input.startsOn) {
    errors.endsOn = "The end date cannot be before the start date.";
  }
  if (input.demoRegistrationUrl) {
    const urlError = validateHttpsUrl(input.demoRegistrationUrl);
    if (urlError) errors.demoRegistrationUrl = urlError;
  }
  if (
    !errors.year &&
    existing.some(
      (semester) =>
        semester.id !== editingId && semester.term === input.term && semester.year === input.year,
    )
  ) {
    errors.term = `${semesterName(input.term, input.year)} already exists.`;
  }
  return errors;
}
