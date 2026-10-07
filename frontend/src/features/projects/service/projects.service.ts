// Reads projects from the backend (GET /api/admin/projects and the resources / archive-impact
// routes). Server-only: it goes through backendFetch, which attaches the admin session token.
import { backendFetch } from "@/shared/api/backend";
import type { ProjectType } from "@/shared/models/project";
import type {
  Project,
  ProjectArchiveImpact,
  ProjectBom,
  ProjectFilters,
  ProjectListPage,
  ProjectMember,
  ProjectResources,
  RosterCandidate,
  ProjectStatus,
  SemesterSummary,
} from "@/features/projects/models/project";

export const PAGE_SIZE = 20;

type ResourceSlot = "SRS" | "FIRST_MEETING" | "BOM";

/** ProjectListItem in backend/src/modules/projects/model/project.model.ts. */
export interface ProjectDto {
  id: string;
  semester_id: string;
  name: string;
  description: string | null;
  type: "SOFTWARE" | "HARDWARE";
  status: "PLANNING" | "ONGOING" | "COMPLETED" | "FAILED";
  updated_at: string;
  member_count: number;
  leader: { roster_member_id: string; full_name: string } | null;
  kickoff: { id: string; status: string; scheduled_at: string | null } | null;
  resources: { present: ResourceSlot[]; missing: ResourceSlot[]; complete: boolean } | null;
}

interface SemesterDto {
  id: string;
  name: string;
  is_current: boolean;
}

/** ResourceView in backend/src/modules/files/model/resource.model.ts. */
interface ResourceDto {
  slot: ResourceSlot;
  source_type: "LINK" | "FILE";
  url: string | null;
  label: string | null;
  file: { original_filename: string; size_bytes: number } | null;
}

export const toBackendType = (type: ProjectType) => type.toUpperCase() as ProjectDto["type"];
export const toBackendStatus = (status: ProjectStatus) =>
  status.toUpperCase() as ProjectDto["status"];

export function mapSemester(dto: SemesterDto): SemesterSummary {
  return {
    id: dto.id,
    // "Sem B 2026" -> "Sem B"
    name: dto.name.replace(/\s+\d{4}$/, ""),
    label: dto.name,
    active: dto.is_current,
  };
}

export function mapProject(dto: ProjectDto): Project {
  return {
    id: dto.id,
    semesterId: dto.semester_id,
    name: dto.name,
    type: dto.type.toLowerCase() as ProjectType,
    status: dto.status.toLowerCase() as ProjectStatus,
    description: dto.description,
    leaderName: dto.leader?.full_name ?? null,
    memberCount: dto.member_count,
    hasMeeting: dto.resources?.present.includes("FIRST_MEETING") ?? false,
    hasBom: dto.resources?.present.includes("BOM") ?? false,
    kickoffAt: dto.kickoff?.scheduled_at ?? null,
    updatedAt: dto.updated_at,
  };
}

export function mapResources(resources: ResourceDto[]): ProjectResources {
  const meeting = resources.find((r) => r.slot === "FIRST_MEETING");
  const bomDto = resources.find((r) => r.slot === "BOM");
  let bom: ProjectBom | null = null;
  if (bomDto?.source_type === "FILE" && bomDto.file) {
    bom = {
      kind: "file",
      filename: bomDto.file.original_filename,
      sizeBytes: bomDto.file.size_bytes,
    };
  } else if (bomDto?.url) {
    bom = { kind: "link", url: bomDto.url, label: bomDto.label };
  }
  return {
    meetingUrl: meeting?.url ?? null,
    meetingLabel: meeting?.label ?? null,
    bom,
  };
}

export async function getProjects(filters: ProjectFilters): Promise<ProjectListPage> {
  const params = new URLSearchParams({ page: String(filters.page), size: String(PAGE_SIZE) });
  if (filters.search) params.set("search", filters.search);
  if (filters.semester) params.set("semesterId", filters.semester);
  if (filters.type !== "all") params.set("type", toBackendType(filters.type));
  if (filters.status !== "all") params.set("status", toBackendStatus(filters.status));
  const data = await backendFetch<{
    semester: SemesterDto | null;
    items: ProjectDto[];
    page: number;
    size: number;
    total: number;
  }>(`/api/admin/projects?${params}`);
  return {
    semester: data.semester ? mapSemester(data.semester) : null,
    items: data.items.map(mapProject),
    page: data.page,
    size: data.size,
    total: data.total,
  };
}

export async function fetchProjectResources(id: string): Promise<ProjectResources> {
  const { resources } = await backendFetch<{ resources: ResourceDto[] }>(
    `/api/admin/projects/${id}/resources`,
  );
  return mapResources(resources);
}

const PENDING_KICKOFF = ["DRAFT", "SCHEDULED", "PROCESSING"];

export async function fetchArchiveImpact(id: string): Promise<ProjectArchiveImpact> {
  const { impact } = await backendFetch<{
    impact: {
      active_members: number;
      kickoff: { status: string; scheduled_at: string | null } | null;
    };
  }>(`/api/admin/projects/${id}/archive-impact`);
  const kickoff = impact.kickoff;
  return {
    activeMembers: impact.active_members,
    pendingKickoffAt:
      kickoff && PENDING_KICKOFF.includes(kickoff.status) ? kickoff.scheduled_at : null,
  };
}

/** ProjectMemberView in backend/src/modules/projects/model/project.model.ts. */
interface ProjectMemberDto {
  roster_member_id: string;
  full_name: string;
  email: string;
  roster_status: "ACTIVE" | "INACTIVE";
  role: "LEADER" | "MEMBER";
}

export function mapProjectMember(dto: ProjectMemberDto): ProjectMember {
  return {
    rosterMemberId: dto.roster_member_id,
    fullName: dto.full_name,
    email: dto.email,
    role: dto.role,
    active: dto.roster_status === "ACTIVE",
  };
}

export async function fetchProjectMembers(id: string): Promise<ProjectMember[]> {
  const { members } = await backendFetch<{ members: ProjectMemberDto[] }>(
    `/api/admin/projects/${id}`,
  );
  return members.map(mapProjectMember);
}

export const CANDIDATE_LIMIT = 8;

/** Active roster entries of a semester matching `search` (name or email). */
export async function fetchRosterCandidates(
  semesterId: string,
  search: string,
): Promise<RosterCandidate[]> {
  const params = new URLSearchParams({ status: "ACTIVE", size: String(CANDIDATE_LIMIT) });
  if (search) params.set("search", search);
  const { items } = await backendFetch<{
    items: { id: string; full_name: string; email: string }[];
  }>(`/api/admin/semesters/${semesterId}/roster?${params}`);
  return items.map((item) => ({
    id: item.id,
    fullName: item.full_name,
    email: item.email,
  }));
}
