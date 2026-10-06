// Mirrors SemesterListItem / CurrentSwitchImpact in backend/src/modules/semesters/model/semester.model.ts
// (snake_case there, camelCase here). Mapping lives in service/semesters.service.ts.
export const SEMESTER_TERMS = ["A", "B", "C"] as const;
export type SemesterTerm = (typeof SEMESTER_TERMS)[number];

export interface Semester {
  id: string;
  term: SemesterTerm;
  year: number;
  /** Generated from term + year, e.g. "Sem B 2027". */
  name: string;
  /** Exactly one semester is current; it decides who is eligible and what members see. */
  isCurrent: boolean;
  /** ISO dates (yyyy-mm-dd); null when not set. */
  startsOn: string | null;
  endsOn: string | null;
  demoRegistrationUrl: string | null;
  /** Active roster entries. */
  rosterCount: number;
  projectCount: number;
}

export interface SemesterInput {
  term: SemesterTerm;
  year: number;
  startsOn: string | null;
  endsOn: string | null;
  demoRegistrationUrl: string | null;
}

export type SemesterPhase = "current" | "upcoming" | "past";

export interface SwitchImpact {
  losing: number;
  gaining: number;
  carryOver: number;
}
