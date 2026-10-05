import type { RenderedEmail, TemplateContext } from "./render.ts";

import { renderBilingual } from "./render.ts";

export function renderDemo(context: TemplateContext): RenderedEmail {
  return renderBilingual(context.subject, {
    intro: {
      en: `Hi ${context.recipientName}, demo day for ${context.semesterName} is coming up.`,
      vi: `Xin chào ${context.recipientName}, buổi demo của ${context.semesterName} sắp diễn ra.`,
    },
    action: {
      en: "Please register your demo slot here:",
      vi: "Vui lòng đăng ký lịch demo tại:",
    },
    link: context.demoUrl ?? "",
  });
}
