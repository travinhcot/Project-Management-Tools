// Reads the member portal (GET /api/me/*). Server-only: it goes through backendFetch, which
// attaches the signed-in member's session token.
import { cache } from "react";
import { backendFetch } from "@/shared/api/backend";
import type { ProjectStatus, ResourceSlot as AnySlot } from "@/features/projects/models/project";
import type { ProjectType } from "@/shared/models/project";
import type {
  ComingUpItem,
  MemberOverview,
  MemberProfile,
  MemberProject,
  MemberProjectDetail,
  MemberResource,
  MemberStatus,
  ResourceSlot,
} from "@/features/member/models/member";

type ResourceDto =
  | { slot: ResourceSlot; kind: "LINK"; label: string | null; url: string }
  | {
      slot: ResourceSlot;
      kind: "FILE";
      label: string | null;
      file: { id: string; filename: string; size_bytes: number };
    };

interface ListItemDto {
  id: string;
  name: string;
  type: "SOFTWARE" | "HARDWARE" | "RESEARCH";
  status: "PLANNING" | "ONGOING" | "COMPLETED" | "FAILED";
  kickoff_at: string | null;
  semester: { id: string; name: string };
  leader_name: string | null;
  member_count: number;
  resource_views: ResourceDto[];
}

interface DetailDto {
  id: string;
  name: string;
  type: ListItemDto["type"];
  status: ListItemDto["status"];
  description: string | null;
  kickoff_at: string | null;
  semester: { id: string; name: string };
  resources: ResourceDto[];
  missing_resources: AnySlot[];
  teammates: { full_name: string; role: "LEADER" | "MEMBER" }[];
}

const toType = (type: ListItemDto["type"]) => type.toLowerCase() as ProjectType;
const toStatus = (status: ListItemDto["status"]) => status.toLowerCase() as ProjectStatus;

function mapResource(dto: ResourceDto): MemberResource {
  return dto.kind === "LINK"
    ? { slot: dto.slot, kind: "link", label: dto.label, url: dto.url }
    : {
        slot: dto.slot,
        kind: "file",
        label: dto.label,
        fileId: dto.file.id,
        filename: dto.file.filename,
        sizeBytes: dto.file.size_bytes,
      };
}

function mapProject(dto: ListItemDto): MemberProject {
  return {
    id: dto.id,
    name: dto.name,
    type: toType(dto.type),
    status: toStatus(dto.status),
    semesterName: dto.semester.name,
    leaderName: dto.leader_name,
    memberCount: dto.member_count,
    kickoffAt: dto.kickoff_at,
    resources: dto.resource_views.map(mapResource),
  };
}

/** Per request: the layout and the page both ask, the backend is called once. */
export const getMemberStatus = cache(async (): Promise<MemberStatus> => {
  const dto = await backendFetch<{
    eligible: boolean;
    email: string | null;
    full_name: string | null;
  }>("/api/me");
  return { eligible: dto.eligible, email: dto.email, fullName: dto.full_name };
});

export async function getMemberProjects(): Promise<MemberProject[]> {
  const dto = await backendFetch<{ items: ListItemDto[] }>("/api/me/projects");
  return dto.items.map(mapProject);
}

export async function getMemberProject(id: string): Promise<MemberProjectDetail> {
  const { project } = await backendFetch<{ project: DetailDto }>(`/api/me/projects/${id}`);
  return {
    id: project.id,
    name: project.name,
    type: toType(project.type),
    status: toStatus(project.status),
    description: project.description,
    semesterName: project.semester.name,
    kickoffAt: project.kickoff_at,
    resources: project.resources.map(mapResource),
    missingResources: project.missing_resources ?? [],
    teammates: project.teammates.map((mate) => ({
      fullName: mate.full_name,
      isLeader: mate.role === "LEADER",
    })),
  };
}

export async function getMemberOverview(): Promise<MemberOverview> {
  const dto = await backendFetch<{
    semester: { id: string; name: string; ends_on: string | null } | null;
    first_name: string;
    projects: ListItemDto[];
    next_meeting: { project_id: string; project_name: string; at: string } | null;
    coming_up: {
      kind: ComingUpItem["kind"];
      project_id: string;
      project_name: string;
      at: string | null;
      url: string | null;
      file: { id: string; filename: string; size_bytes: number } | null;
    }[];
  }>("/api/me/overview");
  return {
    semester: dto.semester && {
      id: dto.semester.id,
      name: dto.semester.name,
      endsOn: dto.semester.ends_on,
    },
    firstName: dto.first_name,
    projects: dto.projects.map(mapProject),
    nextMeeting: dto.next_meeting && {
      projectId: dto.next_meeting.project_id,
      projectName: dto.next_meeting.project_name,
      at: dto.next_meeting.at,
    },
    comingUp: dto.coming_up.map((item) => ({
      kind: item.kind,
      projectId: item.project_id,
      projectName: item.project_name,
      at: item.at,
      url: item.url,
      file: item.file && {
        id: item.file.id,
        filename: item.file.filename,
        sizeBytes: item.file.size_bytes,
      },
    })),
  };
}

export async function getMemberProfile(): Promise<MemberProfile> {
  const dto = await backendFetch<{
    full_name: string;
    email: string;
    department: string | null;
    semesters: {
      id: string;
      name: string;
      is_current: boolean;
      ends_on: string | null;
      project_count: number;
    }[];
  }>("/api/me/profile");
  return {
    fullName: dto.full_name,
    email: dto.email,
    department: dto.department,
    semesters: dto.semesters.map((s) => ({
      id: s.id,
      name: s.name,
      isCurrent: s.is_current,
      endsOn: s.ends_on,
      projectCount: s.project_count,
    })),
  };
}
