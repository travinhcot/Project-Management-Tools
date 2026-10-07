import type { RenderedEmail, TemplateContext } from "./render.ts";

import { renderEmailBody } from "./render.ts";

export function renderKickoff(context: TemplateContext): RenderedEmail {
  const project = context.projectName ?? "your project";
  return renderEmailBody(context.subject, {
    intro: `Hi ${context.recipientName}, the kick-off for "${project}" (${context.semesterName}) is here.`,
    action: "Open the project page to find your resources:",
    link: context.projectUrl ?? "",
    extra: context.meetingUrl
      ? { label: "Join the kick-off meeting:", link: context.meetingUrl }
      : undefined,
  });
}
