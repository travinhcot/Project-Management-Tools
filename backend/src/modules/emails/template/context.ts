import type { TemplateContext } from "./render.ts";

export interface ContextSource {
  readonly subject: string | null;
  readonly recipientName: string;
  readonly projectId: string | null;
  readonly projectName: string | null;
  readonly semesterName: string;
  readonly demoUrl: string | null;
  readonly meetingUrl?: string | null;
}

/** Builds the template input; the project link is `{appUrl}/projects` (no project id). */
export function buildContext(
  source: ContextSource,
  appUrl: string,
): TemplateContext {
  return {
    subject: source.subject ?? "Department of Technology",
    recipientName: source.recipientName,
    projectName: source.projectName,
    projectUrl: source.projectId
      ? `${appUrl.replace(/\/+$/, "")}/projects`
      : null,
    semesterName: source.semesterName,
    demoUrl: source.demoUrl,
    meetingUrl: source.meetingUrl ?? null,
  };
}
