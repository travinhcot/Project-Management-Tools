export const SEMESTER_TERMS = ["A", "B", "C"] as const;
export type SemesterTerm = (typeof SEMESTER_TERMS)[number];

export interface Semester {
  readonly id: string;
  readonly term: SemesterTerm;
  readonly year: number;
  /** Derived by the database from term + year, e.g. "Sem B 2026". */
  readonly name: string;
  /** Exactly one semester is current; it decides who is eligible and what members see. */
  readonly is_current: boolean;
  readonly starts_on: string | null;
  readonly ends_on: string | null;
  readonly demo_registration_url: string | null;
  /** Shared kick-start meeting link; a project's own first-meeting link overrides it. */
  readonly kickoff_meeting_url: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

/** A semester as shown in the admin list: the row plus how much it holds. */
export interface SemesterListItem extends Semester {
  /** ACTIVE roster entries. */
  readonly roster_count: number;
  /** Non-archived projects. */
  readonly project_count: number;
}

export interface SemesterCreate {
  readonly term: SemesterTerm;
  readonly year: number;
  readonly starts_on: string | null;
  readonly ends_on: string | null;
  readonly demo_registration_url: string | null;
}

/** A key that is present with null clears the field (dates and URL only). */
export type SemesterChanges = Partial<
  SemesterCreate & { readonly kickoff_meeting_url: string | null }
>;

export interface SemesterListQuery {
  readonly year?: number;
  readonly term?: SemesterTerm;
}

export interface CurrentSwitchImpact {
  readonly target: Semester;
  readonly current: Pick<Semester, "id" | "name"> | null;
  /** ACTIVE roster members of the current semester who lose access if the target becomes current. */
  readonly members_losing_access: number;
  /** ACTIVE roster members of the target who gain access. */
  readonly members_gaining_access: number;
  /** ACTIVE members (same email) on both rosters; their access does not change. */
  readonly members_carried_over: number;
}

/** Port: semesters needs project counts. The projects module implements it; server.ts connects them. */
export interface ProjectStatsGateway {
  countProjects(semesterId: string): Promise<number>;
}

/** Port: semesters needs member counts. The roster module implements it; server.ts connects them. */
export interface RosterStatsGateway {
  countActiveMembers(semesterId: string): Promise<number>;
  /** ACTIVE members present in both semesters, matched by normalised email. */
  countActiveOverlap(semesterA: string, semesterB: string): Promise<number>;
}
