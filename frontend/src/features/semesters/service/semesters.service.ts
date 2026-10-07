// Reads semesters from the backend (GET /api/admin/semesters). Server-only: it goes through
// backendFetch, which attaches the admin session token from the httpOnly cookie.
import { backendFetch } from "@/shared/api/backend";
import type {
  Semester,
  SemesterTerm,
} from "@/features/semesters/models/semester";
import type { SemesterOption } from "@/shared/components/SemesterSwitcher";

/** SemesterListItem in backend/src/modules/semesters/model/semester.model.ts. */
interface SemesterDto {
  id: string;
  term: SemesterTerm;
  year: number;
  name: string;
  is_current: boolean;
  starts_on: string | null;
  ends_on: string | null;
  demo_registration_url: string | null;
  kickoff_meeting_url?: string | null;
  roster_count: number;
  project_count: number;
}

export function mapSemester(dto: SemesterDto): Semester {
  return {
    id: dto.id,
    term: dto.term,
    year: dto.year,
    name: dto.name,
    isCurrent: dto.is_current,
    startsOn: dto.starts_on,
    endsOn: dto.ends_on,
    demoRegistrationUrl: dto.demo_registration_url,
    kickoffMeetingUrl: dto.kickoff_meeting_url ?? null,
    rosterCount: dto.roster_count,
    projectCount: dto.project_count,
  };
}

export async function getSemesters(): Promise<{
  semesters: Semester[];
  /** Server date (yyyy-mm-dd), used to tell upcoming from past semesters. */
  today: string;
}> {
  const { items } = await backendFetch<{ items: SemesterDto[] }>(
    "/api/admin/semesters",
  );
  return {
    semesters: items.map(mapSemester),
    today: new Date().toISOString().slice(0, 10),
  };
}

/** Every semester, newest first, for the semester switcher. */
export async function getSemesterOptions(): Promise<SemesterOption[]> {
  const { semesters } = await getSemesters();
  return [...semesters]
    .sort((a, b) => b.year - a.year || b.term.localeCompare(a.term))
    .map((semester) => ({
      id: semester.id,
      name: semester.name,
      isCurrent: semester.isCurrent,
    }));
}
