// Shapes follow backend/src/modules/projects/model/project.model.ts (ProjectListItem):
// status PLANNING|ONGOING|COMPLETED|FAILED, member_count, leader, kickoff.scheduled_at.
// The backend uses UPPERCASE enums and snake_case; service/projects.service.ts maps them.
import type { ProjectType } from "@/shared/models/project";

export const PROJECT_STATUSES = [
  "planning",
  "ongoing",
  "completed",
  "failed",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  ongoing: "Ongoing",
  completed: "Completed",
  failed: "Failed",
};

export const RESOURCE_SLOTS = [
  "SRS",
  "FIRST_MEETING",
  "BOM",
  "RESEARCH_TEMPLATE",
  "GITHUB_REPO",
  "DEMO_GUIDE",
] as const;
export type ResourceSlot = (typeof RESOURCE_SLOTS)[number];

/** Slots that take an uploaded file (BOM also takes a link). */
export type FileSlotName = "SRS" | "BOM" | "RESEARCH_TEMPLATE";
/** Slots that take an https link. */
export type LinkSlotName = "FIRST_MEETING" | "BOM" | "GITHUB_REPO" | "DEMO_GUIDE";

/** A resource is either an uploaded file or an external https link. */
export type ResourceSource =
  | { kind: "file"; filename: string; sizeBytes: number }
  | { kind: "link"; url: string; label: string | null };

/**
 * What a project has measured against what its type requires. Computed by the backend
 * (backend/src/shared/resource-rules.ts); the UI only reads it.
 */
export interface ProjectResourceSummary {
  present: ResourceSlot[];
  /** Required slots with nothing in them. */
  missing: ResourceSlot[];
  /** Slots this project type can hold; a slot outside it shows as not applicable. */
  applicable: ResourceSlot[];
}

export interface Project {
  id: string;
  semesterId: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  description: string | null;
  leaderName: string | null;
  memberCount: number;
  /** Which setup resources exist; the details are loaded when a drawer opens. */
  resources: ProjectResourceSummary;
  /** ISO timestamp of the kick-off email, null when none exists. */
  kickoffAt: string | null;
  /** Exact string from the backend; PATCH needs it back as expected_updated_at. */
  updatedAt: string;
}

/** Details of a project's resources (GET /api/admin/projects/:id/resources). */
export interface ProjectResources {
  srs: ResourceSource | null;
  meeting: ResourceSource | null;
  /** Hardware projects only. */
  bom: ResourceSource | null;
  /** Research projects only. */
  researchTemplate: ResourceSource | null;
  githubRepo: ResourceSource | null;
  demoGuide: ResourceSource | null;
}

export interface ProjectArchiveImpact {
  activeMembers: number;
  /** Scheduled time of a kick-off that has not finished sending; null when there is none. */
  pendingKickoffAt: string | null;
}

export interface SemesterSummary {
  id: string;
  /** Short name used in headers and filters, e.g. "Sem A". */
  name: string;
  /** Full label used in drawers, e.g. "Sem A 2026". */
  label: string;
  active: boolean;
}

export interface ProjectFilters {
  search: string;
  type: "all" | ProjectType;
  status: "all" | ProjectStatus;
  /** Semester id from `?semester=`; empty means the current semester. */
  semester: string;
  page: number;
}

export interface ProjectListPage {
  /** Null when no semester is current. */
  semester: SemesterSummary | null;
  items: Project[];
  page: number;
  size: number;
  total: number;
}

export interface ProjectInput {
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  description: string;
}

export const NAME_MAX_LENGTH = 150;
export const DESCRIPTION_MAX_LENGTH = 2000;

export const MAX_URL_LENGTH = 2048;
export const MAX_LABEL_LENGTH = 100;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Allowed extensions per file slot; mirrors ALLOWED_FILE_TYPES in the backend resource model. */
export const FILE_EXTENSIONS: Record<FileSlotName, readonly string[]> = {
  SRS: ["pdf"],
  BOM: ["xlsx", "pdf"],
  RESEARCH_TEMPLATE: ["docx", "pdf"],
};

export type MemberRole = "LEADER" | "MEMBER";

export interface ProjectMember {
  rosterMemberId: string;
  fullName: string;
  email: string;
  role: MemberRole;
  /** False when the roster entry was deactivated after the assignment. */
  active: boolean;
}

/** An active roster entry of the project's semester that can be assigned. */
export interface RosterCandidate {
  id: string;
  fullName: string;
  email: string;
}
