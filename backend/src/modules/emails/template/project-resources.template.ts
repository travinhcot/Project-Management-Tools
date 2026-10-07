import type { RenderedEmail, TemplateContext } from "./render.ts";

import { renderEmailBody } from "./render.ts";

// TODO(EB): placeholder copy until the exact wording is confirmed by the EB.
export function renderProjectResources(context: TemplateContext): RenderedEmail {
  const project = context.projectName ?? "your project";
  return renderEmailBody(context.subject, {
    intro: `Hi ${context.recipientName}, thanks for joining the kick-start for "${project}" (${context.semesterName}). The GitHub repository and video guide are ready; everything you need for this semester is in this link.`,
    action: "Open the project page to find your resources:",
    link: context.projectUrl ?? "",
  });
}
