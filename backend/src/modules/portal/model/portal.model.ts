export type ProjectType = "SOFTWARE" | "HARDWARE";

export type ProjectStatus = "PLANNING" | "ONGOING" | "COMPLETED" | "FAILED";

export type MemberRole = "LEADER" | "MEMBER";

export type ResourceSlot = "SRS" | "FIRST_MEETING" | "BOM";

/** Order in which slots are shown on the project page. */
export const SLOT_ORDER: readonly ResourceSlot[] = [
  "SRS",
  "FIRST_MEETING",
  "BOM",
];

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

export interface ResourceSummary {
  readonly present: readonly ResourceSlot[];
  readonly missing: readonly ResourceSlot[];
  readonly complete: boolean;
}

export interface PortalListItem {
  readonly id: string;
  readonly name: string;
  readonly type: ProjectType;
  readonly status: ProjectStatus;
  readonly kickoff_at: string | null;
  readonly semester: { readonly id: string; readonly name: string };
  readonly resources: {
    readonly present: readonly ResourceSlot[];
    readonly missing: readonly ResourceSlot[];
  } | null;
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
