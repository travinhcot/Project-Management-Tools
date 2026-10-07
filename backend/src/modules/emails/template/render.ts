export interface TemplateContext {
  readonly subject: string;
  readonly recipientName: string;
  readonly projectName: string | null;
  readonly projectUrl: string | null;
  readonly semesterName: string;
  readonly demoUrl: string | null;
  readonly meetingUrl?: string | null;
}

export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export interface Paragraph {
  readonly en: string;
  readonly vi: string;
}

export interface TemplateContent {
  readonly intro: Paragraph;
  readonly action: Paragraph;
  readonly link: string;
  /** Optional second block, e.g. the kick-off meeting link. */
  readonly extra?: { readonly label: Paragraph; readonly link: string };
}

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function extraHtml(content: TemplateContent, lang: "en" | "vi"): string[] {
  if (!content.extra) return [];
  const link = escapeHtml(content.extra.link);
  return [
    `<p>${escapeHtml(content.extra.label[lang])}<br><a href="${link}">${link}</a></p>`,
  ];
}

function extraText(content: TemplateContent, lang: "en" | "vi"): string[] {
  return content.extra
    ? [`${content.extra.label[lang]} ${content.extra.link}`]
    : [];
}

/** Bilingual (EN + VI) body shared by both templates. */
export function renderBilingual(
  subject: string,
  content: TemplateContent,
): RenderedEmail {
  const link = escapeHtml(content.link);
  const html = [
    "<!doctype html>",
    '<html lang="en"><body style="font-family:Arial,sans-serif;line-height:1.5;color:#1a1a1a">',
    `<p>${escapeHtml(content.intro.en)}</p>`,
    `<p>${escapeHtml(content.action.en)}<br><a href="${link}">${link}</a></p>`,
    ...extraHtml(content, "en"),
    '<hr style="border:none;border-top:1px solid #ddd">',
    `<p>${escapeHtml(content.intro.vi)}</p>`,
    `<p>${escapeHtml(content.action.vi)}<br><a href="${link}">${link}</a></p>`,
    ...extraHtml(content, "vi"),
    "</body></html>",
  ].join("\n");
  const text = [
    content.intro.en,
    `${content.action.en} ${content.link}`,
    ...extraText(content, "en"),
    "",
    "---",
    "",
    content.intro.vi,
    `${content.action.vi} ${content.link}`,
    ...extraText(content, "vi"),
  ].join("\n");
  return { subject, html, text };
}
