/** Club footer shared by every email template (HTML and plain-text forms). */

const LINK_STYLE = "color: #191919; font-weight: bold; text-decoration: underline;";
const HEADING_FONT = "font-family: &quot;Times New Roman&quot;, serif; margin: 0; font-size: 16px; line-height: 1.3;";

const OFFICERS: readonly { name: string; role: string; contact: string }[] = [
  { name: "Tin Lam (Mr.)", role: "President", contact: "s4116601@rmit.edu.vn - 0938168276" },
  {
    name: "Dung Dao (Mr.)",
    role: "Technical Vice President",
    contact: "s4088577@rmit.edu.vn - 0903475350",
  },
  {
    name: "Kim Huynh (Ms.)",
    role: "Liaison Vice President",
    contact: "s4123814@rmit.edu.vn - 0705975488",
  },
  {
    name: "Quang Truong (Mr.)",
    role: "Chief of Finance",
    contact: "s4144249@rmit.edu.vn - 0353695927",
  },
];

const LINKS = [
  { label: "Our Facebook", href: "https://www.facebook.com/rmit.nct" },
  { label: "Our Linkedin", href: "https://www.linkedin.com/company/rmit-nct/" },
  { label: "Our Official Website", href: "https://rmitnct.club/" },
] as const;

const officersHtml = OFFICERS.map(
  (officer) =>
    `<b style="color: #6d9eeb">${officer.name} | ${officer.role} |</b><br />` +
    `<i style="color: #bf9000">${officer.contact}</i>`,
).join("<br />");

const linksHtml = LINKS.map(
  (link) => `<a href="${link.href}" style="${LINK_STYLE}">${link.label}</a>`,
).join(" | ");

export const FOOTER_HTML = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding: 28px 32px 36px; font-family: Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #9aa0a6;">
<h1 style="${HEADING_FONT} color: #6d9eeb;">RMIT VIETNAM NEO CULTURE TECHNOLOGY CLUB</h1>
<h3 style="${HEADING_FONT} font-weight: normal; color: #bf9000;">RMIT University Vietnam (SGS campus)</h3>
<h3 style="${HEADING_FONT} font-weight: normal; color: #bf9000;">702 Nguyen Van Linh Blvd, Tan Hung Ward, HCMC</h3>
<h3 style="${HEADING_FONT} color: #191919;">${linksHtml}</h3>
<hr />
<p style="${HEADING_FONT}">${officersHtml}</p>
</td>
</tr></table>`;

export const FOOTER_TEXT = [
  "RMIT VIETNAM NEO CULTURE TECHNOLOGY CLUB",
  "RMIT University Vietnam (SGS campus)",
  "702 Nguyen Van Linh Blvd, Tan Hung Ward, HCMC",
  LINKS.map((link) => `${link.label}: ${link.href}`).join(" | "),
  "",
  ...OFFICERS.flatMap((officer) => [
    `${officer.name} | ${officer.role} |`,
    officer.contact,
  ]),
].join("\n");
