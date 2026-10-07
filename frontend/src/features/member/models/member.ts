// Shapes follow backend/src/modules/portal/model/portal.model.ts. The backend uses UPPERCASE
// enums and snake_case; service/member.service.ts maps them.
import type { ProjectStatus, ResourceSlot } from "@/features/projects/models/project";
import type { ProjectType } from "@/shared/models/project";

export type { ResourceSlot };

/** A resource a member may open. Slots the admin has not filled are simply absent. */
export type MemberResource =
  | { slot: ResourceSlot; kind: "link"; label: string | null; url: string }
  | {
      slot: ResourceSlot;
      kind: "file";
      label: string | null;
      fileId: string;
      filename: string;
      sizeBytes: number;
    };

export interface MemberStatus {
  eligible: boolean;
  email: string | null;
  fullName: string | null;
}

export interface MemberProject {
  id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  semesterName: string;
  leaderName: string | null;
  memberCount: number;
  /** ISO time of the kick-off / first meeting, null when none is scheduled. */
  kickoffAt: string | null;
  resources: MemberResource[];
}

export interface Teammate {
  fullName: string;
  isLeader: boolean;
}

export interface MemberProjectDetail {
  id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  description: string | null;
  semesterName: string;
  kickoffAt: string | null;
  resources: MemberResource[];
  /** Required resources the admin has not shared yet (decided by the backend). */
  missingResources: ResourceSlot[];
  teammates: Teammate[];
}

export interface ComingUpItem {
  kind: "FIRST_MEETING" | "KICKOFF" | "BOM";
  projectId: string;
  projectName: string;
  at: string | null;
  url: string | null;
  file: { id: string; filename: string; sizeBytes: number } | null;
}

export interface MemberOverview {
  semester: { id: string; name: string; endsOn: string | null } | null;
  firstName: string;
  projects: MemberProject[];
  nextMeeting: { projectId: string; projectName: string; at: string } | null;
  comingUp: ComingUpItem[];
}

export interface SemesterAccess {
  id: string;
  name: string;
  isCurrent: boolean;
  endsOn: string | null;
  projectCount: number;
}

export interface MemberProfile {
  fullName: string;
  email: string;
  department: string | null;
  semesters: SemesterAccess[];
}
