export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: string;
}

export const workspaceNav: readonly NavItem[] = [
  { label: "Overview", href: "/overview", icon: "overview" },
  { label: "Projects", href: "/projects", icon: "projects" },
  { label: "Members", href: "/members", icon: "members" },
  { label: "Meeting emails", href: "/meeting-emails", icon: "meeting-emails" },
  { label: "Semesters", href: "/semesters", icon: "semesters" },
  { label: "Users & access", href: "/users-access", icon: "users-access" },
  { label: "Audit log", href: "/audit-log", icon: "audit-log" },
];

export const memberNav: readonly NavItem[] = [
  { label: "Overview", href: "/member/overview", icon: "overview" },
  { label: "My projects", href: "/member/projects", icon: "projects" },
  { label: "My profile", href: "/member/profile", icon: "members" },
];
