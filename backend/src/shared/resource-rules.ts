/**
 * The one definition of which resources a project of each type can hold and must hold.
 * Files, portal (member view), dashboard warnings and emails all read it.
 * The SQL twin is public.resource_slot_allowed / public.project_required_slots
 * (migration/project-resources.schema.sql); keep both in step, test/resource-rules.test.ts
 * pins the table.
 */
export const PROJECT_TYPES = [
  "SOFTWARE",
  "HARDWARE",
  "RESEARCH",
  "EVENT",
  "CONTENT",
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

/** Which project types each department can run (SQL twin: public.department_project_types). */
export const DEPARTMENT_PROJECT_TYPES = {
  TECH: ["SOFTWARE", "HARDWARE", "RESEARCH"],
  MARCOM: ["EVENT", "CONTENT"],
  HR: [],
} as const satisfies Record<string, readonly ProjectType[]>;
export type DepartmentCode = keyof typeof DEPARTMENT_PROJECT_TYPES;

export const RESOURCE_SLOTS = [
  "SRS",
  "FIRST_MEETING",
  "BOM",
  "RESEARCH_TEMPLATE",
  "GITHUB_REPO",
  "DEMO_GUIDE",
  /** MARCOM: the Excel package a team submits at the end of an event/content project. */
  "FINAL_PACKAGE",
] as const;
export type ResourceSlot = (typeof RESOURCE_SLOTS)[number];

/** Slots that take an uploaded file. */
export const FILE_SLOTS = [
  "SRS",
  "BOM",
  "RESEARCH_TEMPLATE",
  "FINAL_PACKAGE",
] as const;
export type FileSlot = (typeof FILE_SLOTS)[number];

/** Slots that take an https link. A BOM takes either; the others take only a link. */
export const LINK_SLOTS = [
  "FIRST_MEETING",
  "BOM",
  "GITHUB_REPO",
  "DEMO_GUIDE",
] as const;
export type LinkSlot = (typeof LINK_SLOTS)[number];

interface SlotRule {
  /** Project types that can hold the slot. */
  readonly appliesTo: readonly ProjectType[];
  /** Project types that must fill it to be complete. */
  readonly requiredFor: readonly ProjectType[];
}

const ALL: readonly ProjectType[] = PROJECT_TYPES;
const TECH: readonly ProjectType[] = DEPARTMENT_PROJECT_TYPES.TECH;
const MARCOM: readonly ProjectType[] = DEPARTMENT_PROJECT_TYPES.MARCOM;

/**
 * EVENT and CONTENT projects have nothing they must be given; their deliverable is the
 * FINAL_PACKAGE the team submits, which the dashboard tracks separately (never "missing").
 * FIRST_MEETING is usually the semester-wide kick-start link (an own link is only an
 * override), so it is never counted as missing. GITHUB_REPO and DEMO_GUIDE are set after
 * the kick-start date, so they are available on every project but never counted as missing.
 */
export const SLOT_RULES: Readonly<Record<ResourceSlot, SlotRule>> = {
  SRS: { appliesTo: TECH, requiredFor: TECH },
  FIRST_MEETING: { appliesTo: ALL, requiredFor: [] },
  BOM: { appliesTo: ["HARDWARE"], requiredFor: ["HARDWARE"] },
  RESEARCH_TEMPLATE: { appliesTo: ["RESEARCH"], requiredFor: ["RESEARCH"] },
  GITHUB_REPO: { appliesTo: TECH, requiredFor: [] },
  DEMO_GUIDE: { appliesTo: TECH, requiredFor: [] },
  FINAL_PACKAGE: { appliesTo: MARCOM, requiredFor: [] },
};

export function slotAppliesTo(slot: ResourceSlot, type: ProjectType): boolean {
  return SLOT_RULES[slot].appliesTo.includes(type);
}

/** Slots a project of this type can hold, in display order. */
export function applicableSlots(type: ProjectType): readonly ResourceSlot[] {
  return RESOURCE_SLOTS.filter((slot) => slotAppliesTo(slot, type));
}

/** Slots a project of this type must fill to be complete. */
export function requiredSlots(type: ProjectType): readonly ResourceSlot[] {
  return RESOURCE_SLOTS.filter((slot) =>
    SLOT_RULES[slot].requiredFor.includes(type),
  );
}

export interface ResourceSummary {
  readonly present: readonly ResourceSlot[];
  /** Required slots with nothing in them. */
  readonly missing: readonly ResourceSlot[];
  readonly complete: boolean;
  /** Every slot this project type can hold (required or not). */
  readonly applicable: readonly ResourceSlot[];
}

/** What a project has, measured against what its type requires. */
export function summarizeResources(
  type: ProjectType,
  present: ReadonlySet<ResourceSlot>,
): ResourceSummary {
  const required = requiredSlots(type);
  const missing = required.filter((slot) => !present.has(slot));
  return {
    present: applicableSlots(type).filter((slot) => present.has(slot)),
    missing,
    complete: missing.length === 0,
    applicable: applicableSlots(type),
  };
}
