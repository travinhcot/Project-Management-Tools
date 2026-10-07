// Reads projects from the backend (GET /api/admin/projects and the resources / archive-impact
// routes). Server-only: it goes through backendFetch, which attaches the admin session token.
import { backendFetch } from "@/shared/api/backend";
import type { ProjectType } from "@/shared/models/project";
import type {
  Project,
  ProjectArchiveImpact,
  ProjectFilters,
  ProjectListPage,
  ProjectMember,
  ProjectResources,
  ResourceSlot,
  ResourceSource,
  RosterCandidate,
  ProjectStatus,
  SemesterSummary,
} from "@/features/projects/models/project";

export const PAGE_SIZE = 20;

/** ProjectListItem in backend/src/modules/projects/model/project.model.ts. */
export interface ProjectDto {
  id: string;
  semester_id: string;
  name: string;
  description: string | null;
  type: "SOFTWARE" | "HARDWARE" | "RESEARCH";
  status: "PLANNING" | "ONGOING" | "COMPLETED" | "FAILED";
  updated_at: string;
  member_count: number;
  leader: { roster_member_id: string; full_name: string } | null;
  kickoff: { id: string; status: string; scheduled_at: string | null } | null;
  resources: {
    present: ResourceSlot[];
    missing: ResourceSlot[];
    applicable: ResourceSlot[];
    complete: boolean;
  } | null;
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
    resources: {
      present: dto.resources?.present ?? [],
      missing: dto.resources?.missing ?? [],
      applicable: dto.resources?.applicable ?? [],
    },
    kickoffAt: dto.kickoff?.scheduled_at ?? null,
    updatedAt: dto.updated_at,
  };
}

function toSource(dto: ResourceDto | undefined): ResourceSource | null {
  if (dto?.source_type === "FILE" && dto.file) {
    return { kind: "file", filename: dto.file.original_filename, sizeBytes: dto.file.size_bytes };
  }
  return dto?.url ? { kind: "link", url: dto.url, label: dto.label } : null;
}

export function mapResources(resources: ResourceDto[]): ProjectResources {
  const source = (slot: ResourceSlot) => toSource(resources.find((r) => r.slot === slot));
  return {
    srs: source("SRS"),
    meeting: source("FIRST_MEETING"),
    bom: source("BOM"),
    researchTemplate: source("RESEARCH_TEMPLATE"),
    githubRepo: source("GITHUB_REPO"),
    demoGuide: source("DEMO_GUIDE"),
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
