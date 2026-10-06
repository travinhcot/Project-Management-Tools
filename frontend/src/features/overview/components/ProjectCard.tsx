import { Pill } from "@/shared/components/Pill";
import type { DashboardProject } from "@/features/overview/models/dashboard";

const types = {
  software: { label: "⌘ Software", tone: "accent", bar: "bg-primary" },
  hardware: { label: "▦ Hardware", tone: "amber", bar: "bg-amber" },
} as const;

const kickoffFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function ProjectCard({ project }: { project: DashboardProject }) {
  const type = types[project.type];
  const memberLabel = project.memberCount === 1 ? "member" : "members";

  return (
    <article className="flex flex-col items-start gap-3 rounded-[10px] border border-line bg-surface p-5">
      <div className={`h-1 w-full rounded-sm ${type.bar}`} />
      <Pill tone={type.tone}>{type.label}</Pill>
      <h3 className="text-[17px] font-semibold text-ink">{project.name}</h3>
      <p className="text-xs text-muted">{project.description}</p>
      <p className="whitespace-pre text-xs font-medium text-muted">
        {project.memberCount} {memberLabel}
        {"   ·   "}Kick-off {kickoffFormat.format(new Date(project.kickoffAt))}
      </p>
    </article>
  );
}
