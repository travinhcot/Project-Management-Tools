import { FOOTER_HTML, FOOTER_TEXT } from "./footer.ts";

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

export interface TemplateContent {
  readonly intro: string;
  readonly action: string;
  readonly link: string;
  /** Optional second block, e.g. the kick-off meeting link. */
  readonly extra?: { readonly label: string; readonly link: string };
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

/** English body shared by both templates. */
export function renderEmailBody(
  subject: string,
  content: TemplateContent,
): RenderedEmail {
  const link = escapeHtml(content.link);
  const extraLink = content.extra ? escapeHtml(content.extra.link) : "";
  const html = [
    "<!doctype html>",
    '<html lang="en"><body style="font-family:Arial,sans-serif;line-height:1.5;color:#1a1a1a">',
    `<p>${escapeHtml(content.intro)}</p>`,
    `<p>${escapeHtml(content.action)}<br><a href="${link}">${link}</a></p>`,
    ...(content.extra
      ? [
          `<p>${escapeHtml(content.extra.label)}<br><a href="${extraLink}">${extraLink}</a></p>`,
        ]
      : []),
    FOOTER_HTML,
    "</body></html>",
  ].join("\n");
  const text = [
    content.intro,
    `${content.action} ${content.link}`,
    ...(content.extra ? [`${content.extra.label} ${content.extra.link}`] : []),
    "",
    "--",
    FOOTER_TEXT,
  ].join("\n");
  return { subject, html, text };
}
