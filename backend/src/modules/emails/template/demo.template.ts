import type { RenderedEmail, TemplateContext } from "./render.ts";

import { renderEmailBody } from "./render.ts";

export function renderDemo(context: TemplateContext): RenderedEmail {
  return renderEmailBody(context.subject, {
    intro: `Hi ${context.recipientName}, demo day for ${context.semesterName} is coming up.`,
    action: "Please register your demo slot here:",
    link: context.demoUrl ?? "",
  });
}
