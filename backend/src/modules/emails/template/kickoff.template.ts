import type { RenderedEmail, TemplateContext } from "./render.ts";

import { renderBilingual } from "./render.ts";

export function renderKickoff(context: TemplateContext): RenderedEmail {
  const project = context.projectName ?? "your project";
  return renderBilingual(context.subject, {
    intro: {
      en: `Hi ${context.recipientName}, the kick-off for "${project}" (${context.semesterName}) is here.`,
      vi: `Xin chào ${context.recipientName}, dự án "${project}" (${context.semesterName}) chính thức khởi động.`,
    },
    action: {
      en: "Open the project page to find your resources:",
      vi: "Mở trang dự án để xem tài liệu của bạn:",
    },
    link: context.projectUrl ?? "",
  });
}
