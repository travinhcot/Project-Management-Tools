export const PROJECT_TYPES = ["software", "hardware", "research"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export function isProjectType(value: unknown): value is ProjectType {
  return (PROJECT_TYPES as readonly unknown[]).includes(value);
}
