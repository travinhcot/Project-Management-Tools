import type {
  ProjectMemberView,
  RosterMemberRef,
} from "../model/project.model.ts";

/** Joins assignment rows with roster details, sorted by name. Unknown roster ids are dropped. */
export function toMemberViews(
  assignments: readonly {
    id: string;
    roster_member_id: string;
    added_at: string;
  }[],
  people: readonly RosterMemberRef[],
): ProjectMemberView[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  return assignments
    .flatMap((assignment) => {
      const person = byId.get(assignment.roster_member_id);
      if (!person) return [];
      return [
        {
          assignment_id: assignment.id,
          roster_member_id: person.id,
          full_name: person.full_name,
          email: person.email,
          roster_status: person.status,
          added_at: assignment.added_at,
        },
      ];
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}
