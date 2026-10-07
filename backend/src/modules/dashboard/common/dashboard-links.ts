import type { Severity, WarningCode } from "../model/dashboard.model.ts";

/** Admin UI paths (SRS 5.3 folder structure). The dashboard only points at them. */
export const LINKS = {
  roster: "/admin/roster",
  projects: "/admin/projects",
  campaigns: "/admin/campaigns",
  failedCampaigns: "/admin/campaigns?status=COMPLETED_WITH_FAILURES",
  imports: "/admin/roster",
} as const;

export const projectLink = (id: string) => `${LINKS.projects}/${id}`;
export const campaignLink = (id: string) => `${LINKS.campaigns}/${id}`;
export const importLink = (id: string) => `${LINKS.imports}/imports/${id}`;

export const WARNING_META: Readonly<
  Record<
    WarningCode,
    {
      readonly severity: Severity;
      readonly message: string;
      readonly link: string;
      readonly itemLink: (id: string) => string;
    }
  >
> = {
  PROJECTS_WITHOUT_MEMBERS: {
    severity: "warning",
    message: "Projects with no assigned members.",
    link: LINKS.projects,
    itemLink: projectLink,
  },
  PROJECTS_MISSING_SRS: {
    severity: "warning",
    message: "SRS missing",
    link: LINKS.projects,
    itemLink: projectLink,
  },
  PROJECTS_MISSING_RESOURCES: {
    severity: "warning",
    message: "Projects missing required resources.",
    link: LINKS.projects,
    itemLink: projectLink,
  },
  CAMPAIGNS_WITH_FAILURES: {
    severity: "error",
    message: "Campaigns that finished with failed deliveries.",
    link: LINKS.failedCampaigns,
    itemLink: campaignLink,
  },
  IMPORTS_EXPIRED_UNUSED: {
    severity: "info",
    message: "Roster import previews that expired without being committed.",
    link: LINKS.imports,
    itemLink: importLink,
  },
  OLD_SEMESTER_CAMPAIGNS_SCHEDULED: {
    severity: "warning",
    message:
      "Campaigns still scheduled for a semester that is no longer current.",
    link: LINKS.campaigns,
    itemLink: campaignLink,
  },
};
