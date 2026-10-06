// Mirrors RosterMemberView in backend/src/modules/members/model/roster-member.model.ts
// (snake_case there, camelCase here).
export const DEPARTMENTS = ["software", "hardware"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  software: "Software",
  hardware: "Hardware",
};

export type MemberStatus = "active" | "inactive";

export interface Member {
  id: string;
  fullName: string;
  email: string;
  /** Optional in the CSV import (only Full Name and Email are required). */
  department: Department | null;
  birthYear: number | null;
  status: MemberStatus;
  /** True once the person has signed in and linked an app account. */
  linked: boolean;
}
