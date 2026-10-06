// Shapes follow backend/src/modules/projects/model/project.model.ts (ProjectListItem):
// status PLANNING|ONGOING|COMPLETED|FAILED, member_count, leader, kickoff.scheduled_at.
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

/** A BOM is either an uploaded file or an external https link (hardware projects only). */
export type ProjectBom =
  | { kind: "file"; filename: string; sizeBytes: number }
  | { kind: "link"; url: string; label: string | null };

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  description: string;
  leaderName: string | null;
  memberCount: number;
  /** First-meeting link; null until an admin adds one. */
  meetingUrl: string | null;
  meetingLabel: string | null;
  /** Hardware projects only; software projects never need a BOM. */
  bom: ProjectBom | null;
  /** ISO timestamp (UTC) of the kick-off email, null when not scheduled. */
  kickoffAt: string | null;
}

export interface SemesterSummary {
  id: string;
  /** Short name used in headers and filters, e.g. "Sem A". */
  name: string;
  /** Full label used in drawers, e.g. "Sem A 2026". */
  label: string;
  active: boolean;
}

export interface ProjectInput {
  name: string;
  type: ProjectType;
  description: string;
}

export const NAME_MAX_LENGTH = 120;

export const MAX_URL_LENGTH = 2048;
export const MAX_LABEL_LENGTH = 100;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const BOM_EXTENSIONS = ["xlsx", "pdf"] as const;
