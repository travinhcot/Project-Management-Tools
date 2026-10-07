import type {
  ProjectType,
  ResourceSlot,
  ResourceSummary,
} from "../../../shared/resource-rules.ts";

export { RESOURCE_SLOTS as SLOT_ORDER } from "../../../shared/resource-rules.ts";
export type { ProjectType, ResourceSlot, ResourceSummary };

export type ProjectStatus = "PLANNING" | "ONGOING" | "COMPLETED" | "FAILED";

export type MemberRole = "LEADER" | "MEMBER";

/** Notifications badge counts resources changed within this window. */
export const BADGE_WINDOW_DAYS = 7;

export interface PortalProjectRow {
  readonly id: string;
  readonly name: string;
  readonly type: ProjectType;
  readonly description: string | null;
  readonly semester_id: string;
  readonly semester_name: string;
  readonly is_current: boolean;
  readonly status: ProjectStatus;
  /** Latest kick-off date that members may see; null when none is scheduled. */
  readonly kickoff_at: string | null;
}

export interface PortalTeammate {
  readonly full_name: string;
  readonly role: MemberRole;
}

export interface Eligibility {
  readonly eligible: boolean;
  readonly semester_id: string | null;
}

export interface PortalProjectSummary {
  readonly leader_name: string | null;
  readonly member_count: number;
}

export interface PortalProfileRow {
  readonly full_name: string;
  readonly email: string;
  readonly department: string | null;
}

export interface PortalSemesterRow {
  readonly semester_id: string;
  readonly name: string;
  readonly is_current: boolean;
  readonly ends_on: string | null;
  readonly project_count: number;
}

export interface PortalListItem {
  readonly id: string;
  readonly name: string;
  readonly type: ProjectType;
  readonly status: ProjectStatus;
  readonly kickoff_at: string | null;
  readonly semester: { readonly id: string; readonly name: string };
  readonly leader_name: string | null;
  readonly member_count: number;
  readonly resources: {
    readonly present: readonly ResourceSlot[];
    readonly missing: readonly ResourceSlot[];
    readonly applicable: readonly ResourceSlot[];
  } | null;
  /** What the member may open or download for this project (absent slots omitted). */
  readonly resource_views: readonly ResourceView[];
}

export type ComingUpKind = "FIRST_MEETING" | "KICKOFF" | "BOM";

export interface ComingUpItem {
  readonly kind: ComingUpKind;
  readonly project_id: string;
  readonly project_name: string;
  /** Meeting/kick-off time; null for a shared file. */
  readonly at: string | null;
  readonly url: string | null;
  readonly file: {
    readonly id: string;
    readonly filename: string;
    readonly size_bytes: number;
  } | null;
  readonly download_url_path: string | null;
}

export interface PortalOverview {
  readonly semester: {
    readonly id: string;
    readonly name: string;
    readonly ends_on: string | null;
  } | null;
  readonly first_name: string;
  readonly projects: readonly PortalListItem[];
  readonly next_meeting: {
    readonly project_id: string;
    readonly project_name: string;
    readonly at: string;
  } | null;
  readonly coming_up: readonly ComingUpItem[];
}

export interface PortalProfile {
  readonly full_name: string;
  readonly email: string;
  readonly department: string | null;
  readonly role: "MEMBER";
  readonly semesters: readonly {
    readonly id: string;
    readonly name: string;
    readonly is_current: boolean;
    readonly ends_on: string | null;
    readonly project_count: number;
  }[];
}

export interface PortalProjectList {
  readonly items: readonly PortalListItem[];
  /** null when past-semester access is disabled (D-05). */
  readonly past: readonly PortalListItem[] | null;
}

export interface LinkResourceView {
  readonly slot: ResourceSlot;
  readonly kind: "LINK";
  readonly label: string | null;
  readonly url: string;
  readonly target: "_blank";
  readonly rel: "noopener noreferrer";
}

export interface FileResourceView {
  readonly slot: ResourceSlot;
  readonly kind: "FILE";
  readonly label: string | null;
  readonly file: {
    readonly id: string;
    readonly filename: string;
    readonly content_type: string;
    readonly size_bytes: number;
  };
  /** POST here (existing member download route) for a short-lived signed URL. */
  readonly download_url_path: string;
}

export type ResourceView = LinkResourceView | FileResourceView;

export interface PortalProjectDetail {
  readonly id: string;
  readonly name: string;
  readonly type: ProjectType;
  readonly description: string | null;
  readonly status: ProjectStatus;
  readonly kickoff_at: string | null;
  readonly semester: { readonly id: string; readonly name: string };
  readonly resources: readonly ResourceView[];
  /** Required resources the admin has not shared yet. */
  readonly missing_resources: readonly ResourceSlot[];
  readonly teammates: readonly {
    readonly full_name: string;
    readonly role: MemberRole;
  }[];
}

// ---------------------------------------------------------------------------
// Ports. Implemented by the files module and connected in server.ts. Portal
// declares only what it needs; it never imports the provider.
// ---------------------------------------------------------------------------

/** The shape of one resource as the files module reports it. */
export interface ResourceRecord {
  readonly slot: ResourceSlot;
  readonly source_type: "LINK" | "FILE";
  readonly url: string | null;
  readonly label: string | null;
  readonly file: {
    readonly id: string;
    readonly original_filename: string;
    readonly content_type: string;
    readonly size_bytes: number;
  } | null;
}

/** Implemented by the files module. */
export interface ResourceGateway {
  summarize(
    projects: readonly { id: string; type: ProjectType }[],
  ): Promise<ReadonlyMap<string, ResourceSummary>>;
  listForProject(
    projectId: string,
  ): Promise<{ readonly resources: readonly ResourceRecord[] }>;
}

export interface PortalDependencies {
  readonly resources: ResourceGateway;
}

export interface PortalOptions {
  /** D-05: members never see closed semesters unless this is turned on. */
  readonly allowPastSemesters?: boolean;
}
