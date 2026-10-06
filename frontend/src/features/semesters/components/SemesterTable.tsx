import { Button } from "@/shared/components/Button";
import { Pill, type PillTone } from "@/shared/components/Pill";
import type { Semester, SemesterPhase } from "@/features/semesters/models/semester";
import { formatRange, getPhase } from "@/features/semesters/utils/semesters";

const PHASE_PILL: Record<SemesterPhase, { tone: PillTone; label: string }> = {
  current: { tone: "success", label: "● Current" },
  upcoming: { tone: "accent", label: "Upcoming" },
  past: { tone: "neutral", label: "Past" },
};

export function SemesterTable({
  semesters,
  today,
  highlightId,
  onEdit,
  onSetCurrent,
}: {
  semesters: Semester[];
  today: string;
  /** Semester whose "set as current" impact is being reviewed. */
  highlightId: string | null;
  onEdit: (semester: Semester) => void;
  onSetCurrent: (semester: Semester) => void;
}) {
  return (
    <div className="min-w-0 flex-1 overflow-x-auto rounded-[10px] border border-line bg-surface py-1.5">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead>
          <tr className="text-[11px] font-bold text-muted">
            <th scope="col" className="px-4 py-2.5 font-bold">SEMESTER</th>
            <th scope="col" className="w-[180px] py-2.5 pr-3 font-bold">DATES</th>
            <th scope="col" className="w-[70px] py-2.5 pr-3 font-bold">ROSTER</th>
            <th scope="col" className="w-[70px] py-2.5 pr-3 font-bold">PROJECTS</th>
            <th scope="col" className="w-[150px] py-2.5 pr-4 font-bold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {semesters.map((semester) => {
            const phase = getPhase(semester, today);
            const pill = PHASE_PILL[phase];
            return (
              <tr
                key={semester.id}
                className={`border-t border-line/60 ${
                  highlightId === semester.id ? "bg-accent-soft/40" : ""
                }`}
              >
                <th scope="row" className="px-4 py-3.5 text-left">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{semester.name}</span>
                    <Pill tone={pill.tone} size="sm">
                      {pill.label}
                    </Pill>
                  </span>
                </th>
                <td className="py-3.5 pr-3 text-[13px] text-ink">
                  {formatRange(semester.startsOn, semester.endsOn)}
                </td>
                <td className="py-3.5 pr-3 text-[13px] text-ink">{semester.rosterCount}</td>
                <td className="py-3.5 pr-3 text-[13px] text-ink">{semester.projectCount}</td>
                <td className="py-3.5 pr-4">
                  <div className="flex items-center gap-3.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(semester)}
                      aria-label={`Edit ${semester.name}`}
                    >
                      Edit
                    </Button>
                    {!semester.isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSetCurrent(semester)}
                        aria-label={`Set ${semester.name} as current`}
                      >
                        Set as current
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
