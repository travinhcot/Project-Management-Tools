export const PROJECT_TYPES = ["SOFTWARE", "HARDWARE"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_STATUSES = [
  "PLANNING",
  "ONGOING",
  "COMPLETED",
  "FAILED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const MEMBER_ROLES = ["LEADER", "MEMBER"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const ARCHIVED_FILTERS = ["exclude", "include", "only"] as const;
export type ArchivedFilter = (typeof ARCHIVED_FILTERS)[number];

export interface Project {
  readonly id: string;
  readonly semester_id: string;
  readonly name: string;
  readonly description: string | null;
  readonly type: ProjectType;
  readonly status: ProjectStatus;
  readonly archived_at: string | null;
  readonly created_by_user_id: string | null;
  readonly created_at: string;
  /** Send this back as expected_updated_at when editing. */
  readonly updated_at: string;
}

export interface ProjectCreate {
  readonly semester_id: string;
  readonly name: string;
  readonly type: ProjectType;
  readonly description: string | null;
  readonly status: ProjectStatus | null;
}

export interface ProjectChanges {
  readonly name?: string;
  readonly description?: string | null;
  readonly type?: ProjectType;
  readonly status?: ProjectStatus;
  readonly semester_id?: string;
}

export interface ProjectUpdate {
  /** The updated_at the client loaded, as the exact string the API returned. */
  readonly expected_updated_at: string;
  readonly changes: ProjectChanges;
}

export interface ProjectListQuery {
  readonly semesterId?: string;
  readonly search?: string;
  readonly type?: ProjectType;
  readonly status?: ProjectStatus;
  readonly archived: ArchivedFilter;
  readonly page: number;
  readonly size: number;
}

export interface ProjectLeader {
  readonly roster_member_id: string;
  readonly full_name: string;
}

export interface ProjectRow extends Project {
  readonly member_count: number;
  readonly leader: ProjectLeader | null;
}

export interface ProjectListItem extends ProjectRow {
  /** null until the resources module is wired in. */
  readonly resources: ResourceSummary | null;
}

export interface ProjectMemberView {
  readonly assignment_id: string;
  readonly roster_member_id: string;
  readonly full_name: string;
  readonly email: string;
  readonly roster_status: "ACTIVE" | "INACTIVE";
  readonly role: MemberRole;
  readonly added_at: string;
}

export interface ProjectDetail {
  readonly project: Project;
  readonly semester: SemesterRef | null;
  readonly members: readonly ProjectMemberView[];
  readonly leader: ProjectLeader | null;
  readonly resources: ResourceSummary | null;
  readonly kickoff: KickoffRef | null;
}

export interface ArchiveImpact {
  readonly project: Project;
  readonly active_members: number;
  readonly kickoff: KickoffRef | null;
}

export interface ProjectAssignment {
  readonly id: string;
  readonly roster_member_id: string;
  readonly role: MemberRole;
  readonly added_at: string;
}

// ---------------------------------------------------------------------------
// Ports. Implemented by other modules and connected in server.ts. Projects
// declares only what it needs; it never imports the providers.
// ---------------------------------------------------------------------------

export interface SemesterRef {
  readonly id: string;
  readonly name: string;
  readonly is_current: boolean;
}

/** Implemented by the semesters module. */
export interface SemesterLookup {
  findCurrent(): Promise<SemesterRef | null>;
  findById(id: string): Promise<SemesterRef | null>;
}

export interface RosterMemberRef {
  readonly id: string;
  readonly full_name: string;
  readonly email: string;
  readonly status: "ACTIVE" | "INACTIVE";
}

/** Implemented by the members module. */
export interface RosterLookup {
  findByIds(ids: readonly string[]): Promise<readonly RosterMemberRef[]>;
}

export type ResourceSlot = "SRS" | "FIRST_MEETING" | "BOM";

export interface ResourceSummary {
  readonly present: readonly ResourceSlot[];
  readonly missing: readonly ResourceSlot[];
  readonly complete: boolean;
}

/** Optional: implemented by the resources module when it exists. One call per page. */
export interface ResourceSummaryGateway {
  summarize(
    projects: readonly { id: string; type: ProjectType }[],
  ): Promise<ReadonlyMap<string, ResourceSummary>>;
}

export interface KickoffRef {
  readonly id: string;
  readonly status: "DRAFT" | "SCHEDULED" | "PROCESSING";
  readonly scheduled_at: string;
}

/** Optional: implemented by the emails module when it exists. */
export interface KickoffGateway {
  findActiveKickoff(projectId: string): Promise<KickoffRef | null>;
  /** Throws a 409-style error when the campaign is no longer cancellable. */
  cancel(input: {
    campaignId: string;
    actorId: string;
    requestId: string;
  }): Promise<void>;
}

export interface ProjectDependencies {
  readonly semesters: SemesterLookup;
  readonly roster: RosterLookup;
  readonly resources?: ResourceSummaryGateway;
  readonly kickoffs?: KickoffGateway;
}
